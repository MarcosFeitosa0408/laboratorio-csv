# Laboratório CSV — Explorando Dados

Página estática para testar a importação de pagamentos, validar transações e acompanhar indicadores por canal. Os CSVs de teste contêm dados fictícios.

## Arquivos

- `index.html` — Página do laboratório.
- `style.css` — Aparência e layout.
- `laboratorio.js` — Importação, validação e cálculo dos indicadores.
- `explorando_dados_pagamentos_teste.csv` — Base válida usada pelo botão Carregar base de exemplo.
- `testes/explorando_dados_teste_id_duplicado.csv` — Cópia de teste com o ID TX-00001 repetido no registro 121.

## Publicar no GitHub Pages

Extraia o ZIP e coloque o conteúdo extraído na raiz de um repositório, mantendo a pasta `testes/` e o `index.html` na raiz. Configure o GitHub Pages para publicar a raiz da branch escolhida. A página usa HTML, CSS e JavaScript e pode ser publicada sem instalação de dependências.

## Conferir a importação

1. Abra a página publicada e clique em **Carregar base de exemplo**. O painel deve mostrar 120 tentativas, 90 aprovações, taxa de aprovação de 75% e saldo de R$ 75.130,49.
2. Clique em **Importar CSV** e selecione o arquivo duplicado que está na pasta `testes/`. A página deve avisar sobre o registro 121 e preservar os indicadores da última base válida.

Os arquivos selecionados manualmente são processados no navegador.
