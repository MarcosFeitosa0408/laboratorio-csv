"use strict";

const campos = ["ID_Transacao", "Data_Transacao", "Canal", "Status_Transacao", "Valor_Transacao", "Valor_Estornado"];
const statusValidos = new Set(["aprovada", "recusada", "pendente"]);
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function lerCsv(texto) {
  texto = texto.replace(/^\uFEFF/, "");
  const cabecalho = texto.split(/\r?\n/, 1)[0];
  const separador = cabecalho.includes(";") ? ";" : ",";
  const linhas = [];
  let linha = [];
  let campo = "";
  let entreAspas = false;
  let fechouAspas = false;

  function guardarCampo() {
    linha.push(campo.trim());
    campo = "";
    fechouAspas = false;
  }

  function guardarLinha() {
    guardarCampo();
    if (linha.some(Boolean)) linhas.push(linha);
    linha = [];
  }

  for (let i = 0; i < texto.length; i++) {
    const caractere = texto[i];
    if (entreAspas) {
      if (caractere === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (caractere === '"') {
        entreAspas = false;
        fechouAspas = true;
      } else {
        campo += caractere;
      }
    } else if (caractere === separador) {
      guardarCampo();
    } else if (caractere === "\r" || caractere === "\n") {
      if (caractere === "\r" && texto[i + 1] === "\n") i++;
      guardarLinha();
    } else if (caractere === '"' && !campo && !fechouAspas) {
      entreAspas = true;
    } else if (caractere === '"' || (fechouAspas && caractere.trim())) {
      throw new Error("O CSV contém aspas em posição inválida.");
    } else if (!fechouAspas) {
      campo += caractere;
    }
  }
  if (entreAspas) throw new Error("Há um campo com aspas abertas no CSV.");
  guardarLinha();
  return linhas;
}

function centavos(valor) {
  if (!/^\d{1,10}(?:[.,]\d{1,2})?$/.test(valor)) return null;
  const [reais, cent] = valor.split(/[.,]/);
  return Number(reais) * 100 + Number((cent ?? "").padEnd(2, "0"));
}

function dataValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(valor + "T00:00:00Z");
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function preparar(texto) {
  const [cabecalho, ...linhas] = lerCsv(texto);
  if (!cabecalho?.length) throw new Error("O arquivo está vazio.");
  const normalizar = nome => nome.toLowerCase();
  const posicoes = campos.map(nome => cabecalho.findIndex(item => normalizar(item) === normalizar(nome)));
  const ausentes = campos.filter((_, i) => posicoes[i] < 0);
  if (ausentes.length) throw new Error("Colunas obrigatórias ausentes: " + ausentes.join(", ") + ".");
  if (new Set(cabecalho.map(normalizar)).size !== cabecalho.length) throw new Error("O cabeçalho tem nomes de coluna duplicados.");
  if (!linhas.length) throw new Error("O arquivo tem cabeçalho, mas está sem transações.");

  const ids = new Set();
  return linhas.map((linha, i) => {
    const erro = mensagem => { throw new Error("Registro " + (i + 1) + ": " + mensagem); };
    if (linha.length !== cabecalho.length) erro("quantidade de colunas diferente do cabeçalho.");
    const [id, data, canal, statusOriginal, valorTexto, estornoTexto] = posicoes.map(posicao => linha[posicao]);
    const status = statusOriginal.toLowerCase();
    const valor = centavos(valorTexto);
    const estorno = centavos(estornoTexto);
    if (!id || ids.has(id)) erro("ID vazio ou duplicado.");
    if (!dataValida(data)) erro("data inválida. Use AAAA-MM-DD.");
    if (!canal) erro("canal não informado.");
    if (!statusValidos.has(status)) erro("status inválido. Use Aprovada, Recusada ou Pendente.");
    if (valor === null || estorno === null || estorno > valor) erro("valor ou estorno inválido.");
    if (estorno && status !== "aprovada") erro("estorno em transação sem aprovação.");
    ids.add(id);
    return { id, data, canal, status, valor, estorno };
  });
}

function consolidar(linhas) {
  const aprovadas = linhas.filter(item => item.status === "aprovada");
  const aprovado = aprovadas.reduce((soma, item) => soma + item.valor, 0);
  const estornado = aprovadas.reduce((soma, item) => soma + item.estorno, 0);
  return { tentativas: linhas.length, aprovadas: aprovadas.length, aprovado, estornado, saldo: aprovado - estornado };
}

const campoArquivo = document.querySelector("#arquivo");
const filtro = document.querySelector("#canal");
const mensagem = document.querySelector("#mensagem");
let base = [];
let operacao = 0;

function informar(texto, erro = false) {
  mensagem.textContent = texto;
  mensagem.dataset.error = String(erro);
}

function renderizar() {
  const linhas = filtro.selectedIndex === 0 ? base : base.filter(item => item.canal === filtro.value);
  const total = consolidar(linhas);
  const indicadores = [
    ["Tentativas", total.tentativas],
    ["Pagamentos aprovados", total.aprovadas],
    ["Taxa de aprovação", total.tentativas ? percentual.format(total.aprovadas / total.tentativas) : "—"],
    ["Valor aprovado", moeda.format(total.aprovado / 100)],
    ["Valor estornado", moeda.format(total.estornado / 100)],
    ["Saldo após estornos", moeda.format(total.saldo / 100)]
  ];
  document.querySelector("#indicadores").replaceChildren(...indicadores.map(([rotulo, valor]) => {
    const card = document.createElement("div");
    card.className = "metric";
    const nome = document.createElement("span");
    const numero = document.createElement("strong");
    nome.textContent = rotulo;
    numero.textContent = valor;
    card.append(nome, numero);
    return card;
  }));
  const previa = linhas.slice(0, 12);
  document.querySelector("#quantidade-previa").textContent = previa.length + " de " + linhas.length + " transações exibidas.";
  document.querySelector("#linhas").replaceChildren(...previa.map(item => {
    const linha = document.createElement("tr");
    const valores = [item.id, item.data.split("-").reverse().join("/"), item.canal,
      item.status[0].toUpperCase() + item.status.slice(1), moeda.format(item.valor / 100), moeda.format(item.estorno / 100)];
    valores.forEach((valor, i) => {
      const celula = document.createElement(i ? "td" : "th");
      if (!i) celula.scope = "row";
      celula.textContent = valor;
      linha.append(celula);
    });
    return linha;
  }));
}

async function carregar(nome, obterTexto) {
  const atual = ++operacao;
  informar("Lendo " + nome + "…");
  try {
    const linhas = preparar(await obterTexto());
    if (atual !== operacao) return;
    base = linhas;
    const canais = [...new Set(base.map(item => item.canal))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    filtro.replaceChildren(new Option("Todos os canais", ""), ...canais.map(canal => new Option(canal, canal)));
    renderizar();
    document.querySelector("#painel").hidden = false;
    informar(nome + " · " + base.length + " transações importadas.");
  } catch (erro) {
    if (atual === operacao) informar(erro.message + (base.length ? " O painel mantém a última base válida." : ""), true);
  }
}

campoArquivo.addEventListener("change", () => {
  const arquivo = campoArquivo.files[0];
  campoArquivo.value = "";
  if (arquivo) carregar(arquivo.name, async () => {
    if (!/\.csv$/i.test(arquivo.name)) throw new Error("Selecione um arquivo com extensão .csv.");
    if (arquivo.size > 5 * 1024 * 1024) throw new Error("Selecione um CSV de até 5 MB.");
    return arquivo.text();
  });
});

document.querySelector("#exemplo").addEventListener("click", () => {
  const nome = "explorando_dados_pagamentos_teste.csv";
  carregar(nome, async () => {
    const resposta = await fetch(nome);
    if (!resposta.ok) throw new Error("A base de exemplo não pôde ser carregada. Tente baixar o arquivo.");
    return resposta.text();
  });
});

filtro.addEventListener("change", renderizar);
