//! Modelo declarativo das 10 telas × 5 campos (ADR-004 §2.1, RF-01).
//!
//! I = identidade · C = conteúdo · P = prompt+ações · E = estado · A = meio.
//! Texto extraído do transcript congelado e de `install.mjs:2264-2436` @ c63e333;
//! nenhum prompt/default/range/mensagem/transição novo. Apenas dados: a tela
//! interpela/formata e nunca grava (RF-05) — aplicação fica no motor (ADR-003).

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Tela {
    pub id: &'static str,
    pub identidade: &'static str,
    pub conteudo: &'static str,
    pub prompt: &'static str,
    pub estado: &'static str,
    pub meio: &'static str,
}

pub const TELAS: [Tela; 10] = [
    Tela {
        id: "W0",
        identidade: "W0 pre-flight",
        conteudo: "[OK] W0 pre-flight: target=… node=… e [OK] W0: pico-fim (:1-2)",
        prompt: "nenhum prompt; ação preflight (leitura)",
        estado: "aguardando → pré-vôo OK → aborto",
        meio: "progresso em stderr, envelope em stdout, sem prompt",
    },
    Tela {
        id: "W1",
        identidade: "W1 inventario do destino",
        conteudo: "[INFO] W1 … + 7 linhas [OK]/[AVISO] por camada (:3-10)",
        prompt: "nenhum prompt; inventario (leitura)",
        estado: "aguardando → inventariado → aborto",
        meio: "ordem das 7 camadas é a do oráculo; stderr",
    },
    Tela {
        id: "W2",
        identidade: "W2 deteccao (pubspec.yaml)",
        conteudo: "[INFO] W2 deteccao … + [AVISO] sem pubspec.yaml — stack sera escolhida no W2m. (:11-12)",
        prompt: "nenhum prompt; detect (leitura)",
        estado: "aguardando → detectado (hasPubspec true/false) → aborto",
        meio: "detecção não ecoa segredo; terminal:false permitido",
    },
    Tela {
        id: "W2m-1",
        identidade: "[1/2] tipo de projeto",
        conteudo: "[INFO] W2m tipo de projeto — escolha o tipo do seu projeto: + itens 1)..5) (:13-18)",
        prompt: "[1/2] escolha [1-5] (q cancela) > ",
        estado: "aguardando → selecionado → aborto; next decide o passo 2",
        meio: "prompt em stderr, IsTerminal escolhe edição vs pipe, sem segredo",
    },
    Tela {
        id: "W2m-2",
        identidade: "[2/2] frontend",
        conteudo: "[INFO] W2m frontend — qual o frontend do seu projeto web: + 1) Vue (default) / 2) React (:21-23)",
        prompt: "[2/2] escolha [1-2] (default: 1) (q cancela) > ",
        estado: "aguardando → menuStack = front.stack → W3; inválido repete; aborto",
        meio: "default aparece no prompt, não em documentação; stderr",
    },
    Tela {
        id: "W3",
        identidade: "[1/5]..[5/5] Q&A",
        conteudo: "5 perguntas + [OK] chave = valor por resposta; segredo nunca em claro (:26-39)",
        prompt: "[i/5] <prompt> (default: …) (q cancela); readSecretPrompt quando canNoEcho; q vale no segredo; inválido repete com formatError",
        estado: "aguardando → respondido → retry (BAD_ANSWER) → aborto; deployToken vazio permitido",
        meio: "TTY sem eco; pipe sem setRawMode; envelope sem campo secret",
    },
    Tela {
        id: "W4",
        identidade: "W4 resumo + previa",
        conteudo: "[INFO] W4 resumo das respostas (segredos omitidos): + serializeAnswers + [INFO] W4 previa do plano (reusa printPlan): + plano de instalacao: + resumo: 218 itens + classes (:40-263)",
        prompt: "nenhum prompt; assertCreateOnly quando createOnly",
        estado: "aguardando → prévia → create-only OK / flagged-open (0 writes) → aborto",
        meio: "resumo omite deployToken; printPlan sanitiza; stderr",
    },
    Tela {
        id: "W5",
        identidade: "W5 confirmacao por camada",
        conteudo: "[INFO] W5 confirmacao por camada: / [INFO] W5 dry-run: confirmacao por camada dispensada (nada sera aplicado). + [INFO] dry-run: NÃO EXECUTADO — nenhum write (plano + relatório apenas) (:264-265)",
        prompt: "confirmByLayer por camada, --yes pula, q/EOF aborta",
        estado: "aguardando → confirmado por camada → aborto (0 writes) → dry-run retorna antecipado",
        meio: "aborto = 0 writes; sem segredo; stderr",
    },
    Tela {
        id: "W6",
        identidade: "W6 backup + aplicacao",
        conteudo: "[INFO] W6 backup + aplicacao: + [i/total] <action> <path> + [OK] apply: pico-fim",
        prompt: "nenhum prompt; aplicação injetada pela CLI; escrita só no motor",
        estado: "aguardando → aplicado → MISSING_INCOMING (0 writes) → sem aplicação/dry-run: W6/W7 nao executados …; nenhum write (:266)",
        meio: "tela formata; aplicação e manifesto pertencem ao motor (ADR-003)",
    },
    Tela {
        id: "W7",
        identidade: "W7 manifesto + checks",
        conteudo: "[INFO] W7 manifesto + checks: + [OK] manifesto: <path> + [OK|ERRO] checks: PASS|FAIL […] + [OK] checks: pico-fim",
        prompt: "nenhum prompt; manifesto e checks via op de engine",
        estado: "aguardando → PASS (0) / FAIL (1, escrita já feita; rollback = backup verificado)",
        meio: "vereditos são literais externos (ADR-002/003); stderr; sem segredo",
    },
];

/// 5 campos na ordem I/C/P/E/A.
pub fn campos(tela: &Tela) -> [&'static str; 5] {
    [
        tela.identidade,
        tela.conteudo,
        tela.prompt,
        tela.estado,
        tela.meio,
    ]
}

/// 10 telas × 5 campos = 50 (RF-01).
pub fn total_campos() -> usize {
    TELAS.len() * 5
}
