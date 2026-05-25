export const config = { runtime: 'edge' };

const SCOPE_INSTRUCTIONS = {
  fiscal:        'Verifique precisao tecnica em materia fiscal: tributos (IRPF, IRPJ, IPI, ICMS, ISS, IOF, ITR), fatos geradores, bases de calculo, aliquotas, isencoes, imunidades e nomenclaturas oficiais.',
  tributario:    'Verifique precisao tributaria: regimes (Simples Nacional, Lucro Presumido, Lucro Real), compensacoes, deducoes, substituicao tributaria e conceitos do CTN.',
  contabil:      'Verifique precisao contabil: normas CPC/IFRS, classificacao de contas, lancamentos, depreciacao, provisoes e terminologia contabil conforme CFC.',
  obrigacoes:    'Verifique obrigacoes acessorias: prazos e nomenclaturas de SPED, EFD-Reinf, DCTFWeb, eSocial, ECF, ECD, EFD-Contribuicoes, DCTF, DIRF (extinta 2025), NF-e, NFS-e.',
  previdenciario:'Verifique precisao previdenciaria: INSS, retencao sobre servicos, CPRB, GPS, GFIP, contribuicoes patronais e normas RGPS.',
  trabalhista:   'Verifique precisao trabalhista: CLT, FGTS, ferias, 13 salario, horas extras, rescisao, CTPS e normas do MTE.',
  reforma:       'Verifique precisao sobre Reforma Tributaria: EC 132/2023, LC 214/2025, IBS, CBS, IS, transicao ate 2033.',
  noticias:      'Verifique alinhamento com contexto regulatorio 2024-2025: novas instrucoes normativas e noticias da Receita Federal.',
  ortografia:    'Revise ortografia, gramatica, concordancia, pontuacao, crase e clareza em portugues brasileiro.',
};

const SCOPE_LABELS = {
  fiscal: 'Fiscal', tributario: 'Tributario', contabil: 'Contabil',
  obrigacoes: 'Obrigacoes Acessorias', previdenciario: 'Previdenciario',
  trabalhista: 'Trabalhista', reforma: 'Reforma Tributaria',
  noticias: 'Noticias e Contexto', ortografia: 'Ortografia e Gramatica',
};

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

    const systemPrompt = `Voce e o Revisor Tecnico Jettax. Revise o material (formato: ${format}).

Escopos ativos:
${scopeLines}

Retorne APENAS JSON puro sem markdown nem texto extra. Estrutura obrigatoria:
{"findings":[{"type":"ok","badge":"CORRETO","scope":"nome","title":"titulo","body":"explicacao","source":"fonte"}]}

Tipos: err (erro factual), warn (atencao), ok (correto). Inclua ao menos 1 ok.`;

    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
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

    const anthropicData = await anthropicResp.json();

    if (!anthropicResp.ok) {
      return new Response(JSON.stringify({ error: { message: anthropicData.error?.message || `Erro ${anthropicResp.status}` } }), {
        status: anthropicResp.status, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract raw text
    const raw = anthropicData.content.map(b => b.text || '').join('');

    // Strip everything before first { and after last }
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('Modelo nao retornou JSON. Tente novamente.');
    }
    const jsonStr = raw.slice(start, end + 1);
    const parsed = JSON.parse(jsonStr);

    // Normalize badges and types
    const BADGE = { err: '❌ INCORRETO', warn: '⚠️ ATENCAO', ok: '✅ CORRETO', error: '❌ INCORRETO' };
    const TYPE_MAP = { error: 'err' };
    parsed.findings = parsed.findings.map(f => ({
      ...f,
      type: TYPE_MAP[f.type] || f.type,
      badge: BADGE[f.type] || f.badge
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
