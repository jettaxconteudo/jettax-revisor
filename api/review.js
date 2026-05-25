export const config = { runtime: 'edge' };

const SCOPE_INSTRUCTIONS = {
  fiscal:        'Verifique precisão técnica em matéria fiscal: tributos (IRPF, IRPJ, IPI, ICMS, ISS, IOF, ITR), fatos geradores, bases de cálculo, alíquotas, isenções, imunidades, regime de caixa vs competência e nomenclaturas oficiais corretas.',
  tributario:    'Verifique precisão tributária: regimes (Simples Nacional, Lucro Presumido, Lucro Real, Lucro Arbitrado), compensações, deduções, planejamento tributário, responsabilidade solidária, substituição tributária e conceitos do CTN.',
  contabil:      'Verifique precisão contábil: normas CPC/IFRS, classificação de contas, lançamentos, reconhecimento de receitas e despesas, depreciação, provisões e terminologia contábil correta conforme CFC.',
  obrigacoes:    'Verifique obrigações acessórias: prazos, periodicidades e nomenclaturas corretas de SPED, EFD-Reinf, DCTFWeb, eSocial, ECF, ECD, EFD-Contribuições, DCTF, DIRF (extinta em 2025), NF-e, NFS-e e demais obrigações digitais.',
  previdenciario:'Verifique precisão previdenciária: INSS, retenção sobre serviços (cessão de mão de obra), CPRB, GPS, GFIP, contribuições patronais, segurado empregado vs contribuinte individual, benefícios (aposentadoria, auxílio-doença) e normas RGPS.',
  trabalhista:   'Verifique precisão trabalhista: CLT, FGTS, férias, 13º salário, horas extras, rescisão, CTPS, eSocial para eventos trabalhistas, convenções coletivas e normas do MTE.',
  reforma:       'Verifique precisão sobre a Reforma Tributária: EC 132/2023, LC 214/2025, IBS (substitui ICMS e ISS), CBS (substitui PIS/COFINS), IS (Imposto Seletivo), transição até 2033, extinção do PIS/COFINS e prazos.',
  noticias:      'Verifique se o conteúdo está alinhado com o contexto regulatório recente (2024-2025): novas instruções normativas, portarias e notícias da Receita Federal. Aponte afirmações que possam ter sido superadas por norma posterior.',
  ortografia:    'Revise ortografia, gramática, concordância verbal e nominal, pontuação, crase, regência e clareza do texto em português brasileiro. Indique cada erro encontrado com a forma correta.',
};

const SCOPE_LABELS = {
  fiscal: 'Fiscal', tributario: 'Tributário', contabil: 'Contábil',
  obrigacoes: 'Obrigações Acessórias', previdenciario: 'Previdenciário',
  trabalhista: 'Trabalhista', reforma: 'Reforma Tributária',
  noticias: 'Notícias / Contexto', ortografia: 'Ortografia e Gramática',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: { message: 'API key não configurada' } }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { text, scopes, format } = await req.json();

    const scopeInstructions = scopes.map(s =>
      `- ${SCOPE_LABELS[s] || s}: ${SCOPE_INSTRUCTIONS[s] || s}`
    ).join('\n');

    const systemPrompt = [
      'Você é o Revisor Técnico Jettax, especialista em conteúdo fiscal, tributário, contábil e linguístico brasileiro.',
      '',
      'Sua função é revisar materiais produzidos pela equipe de conteúdo da Jettax com rigor técnico e precisão.',
      '',
      `O material é do formato: ${format}. Adapte sua análise — posts de redes sociais usam linguagem informal e sintética, o que é esperado; foque na precisão técnica.`,
      '',
      'Escopos de revisão (revise APENAS estes aspectos):',
      scopeInstructions,
      '',
      'IMPORTANTE: Responda SOMENTE com JSON válido, sem texto antes ou depois, sem blocos de código.',
      'Estrutura obrigatória:',
      '{"findings":[{"type":"err","badge":"INCORRETO","scope":"nome","title":"titulo","body":"explicacao","source":"fonte"}]}',
      '',
      'Tipos: "err" para erros factuais, "warn" para pontos de atenção, "ok" para informações corretas.',
      'Inclua ao menos 1 item "ok" quando o conteúdo estiver correto.',
      'Use badge "INCORRETO" para err, "ATENCAO" para warn, "CORRETO" para ok.',
    ].join('\n');

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
        messages: [{ role: 'user', content: `Revise:\n\n${text}` }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: { message: data.error?.message || `Erro ${response.status}` } }), {
        status: response.status, headers: { 'Content-Type': 'application/json' }
      });
    }

    const raw = data.content.map(b => b.text || '').join('').trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Resposta inválida da IA');
    const parsed = JSON.parse(match[0]);

    // Normalize badges
    parsed.findings = parsed.findings.map(f => ({
      ...f,
      badge: f.type === 'err' ? '❌ INCORRETO' : f.type === 'warn' ? '⚠️ ATENÇÃO' : '✅ CORRETO'
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
