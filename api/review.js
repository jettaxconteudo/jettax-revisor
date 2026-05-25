export const config = { runtime: 'edge' };

const SCOPE_INSTRUCTIONS = {
  fiscal:        'Verifique precisao tecnica em materia fiscal: tributos (IRPF, IRPJ, IPI, ICMS, ISS, IOF, ITR), fatos geradores, bases de calculo, aliquotas, isencoes, imunidades, regime de caixa vs competencia e nomenclaturas oficiais corretas.',
  tributario:    'Verifique precisao tributaria: regimes (Simples Nacional, Lucro Presumido, Lucro Real, Lucro Arbitrado), compensacoes, deducoes, planejamento tributario, responsabilidade solidaria, substituicao tributaria e conceitos do CTN.',
  contabil:      'Verifique precisao contabil: normas CPC/IFRS, classificacao de contas, lancamentos, reconhecimento de receitas e despesas, depreciacao, provisoes e terminologia contabil correta conforme CFC.',
  obrigacoes:    'Verifique obrigacoes acessorias: prazos, periodicidades e nomenclaturas corretas de SPED, EFD-Reinf, DCTFWeb, eSocial, ECF, ECD, EFD-Contribuicoes, DCTF, DIRF (extinta em 2025), NF-e, NFS-e.',
  previdenciario:'Verifique precisao previdenciaria: INSS, retencao sobre servicos, CPRB, GPS, GFIP, contribuicoes patronais, segurado empregado vs contribuinte individual, beneficios e normas RGPS.',
  trabalhista:   'Verifique precisao trabalhista: CLT, FGTS, ferias, 13 salario, horas extras, rescisao, CTPS, eSocial trabalhista, convencoes coletivas e normas do MTE.',
  reforma:       'Verifique precisao sobre Reforma Tributaria: EC 132/2023, LC 214/2025, IBS (substitui ICMS e ISS), CBS (substitui PIS/COFINS), IS (Imposto Seletivo), transicao ate 2033.',
  noticias:      'Verifique alinhamento com contexto regulatorio recente 2024-2025: novas instrucoes normativas, portarias e noticias da Receita Federal.',
  ortografia:    'Revise ortografia, gramatica, concordancia verbal e nominal, pontuacao, crase, regencia e clareza do texto em portugues brasileiro.',
};

const SCOPE_LABELS = {
  fiscal: 'Fiscal', tributario: 'Tributario', contabil: 'Contabil',
  obrigacoes: 'Obrigacoes Acessorias', previdenciario: 'Previdenciario',
  trabalhista: 'Trabalhista', reforma: 'Reforma Tributaria',
  noticias: 'Noticias e Contexto', ortografia: 'Ortografia e Gramatica',
};

function stripFences(text) {
  return text
    .replace(/^[\s\S]*?(\{)/, '$1')
    .replace(/\}[\s\S]*$/, '}');
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: { message: 'API key nao configurada' } }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { text, scopes, format } = await req.json();

    const scopeLines = scopes.map(s =>
      `- ${SCOPE_LABELS[s] || s}: ${SCOPE_INSTRUCTIONS[s] || s}`
    ).join('\n');

    const systemPrompt = `Voce e o Revisor Tecnico Jettax, especialista em conteudo fiscal, tributario, contabil e linguistico brasileiro.

Revise o material enviado com rigor tecnico. O formato e: ${format}.

Escopos ativos:
${scopeLines}

INSTRUCAO CRITICA: Retorne APENAS um objeto JSON puro, sem nenhum texto antes ou depois, sem blocos de codigo, sem acentos nas chaves. Use exatamente esta estrutura:
{"findings":[{"type":"ok","badge":"CORRETO","scope":"nome","title":"titulo sem aspas especiais","body":"explicacao","source":"fonte"}]}

Tipos permitidos: err, warn, ok. Inclua ao menos 1 item ok quando o conteudo estiver correto.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: { message: data.error?.message || `Erro ${response.status}` } }), {
        status: response.status, headers: { 'Content-Type': 'application/json' }
      });
    }

    const raw = data.content.map(b => b.text || '').join('');
    const jsonStr = stripFences(raw);
    const parsed = JSON.parse(jsonStr);

    parsed.findings = parsed.findings.map(f => ({
      ...f,
      badge: f.type === 'err' ? '❌ INCORRETO' : f.type === 'warn' ? '⚠️ ATENCAO' : '✅ CORRETO'
    }));

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: { message: err.message } }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
