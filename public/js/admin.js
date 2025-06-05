// public/js/admin.js

// Elementos do DOM – produtos
const formAddProduto = document.getElementById('form-add-produto');
const produtoIdInput = document.getElementById('produto-id');
const nomeInput = document.getElementById('nome-produto');
const qtdeInput = document.getElementById('qtde-produto');
const validadeInput = document.getElementById('validade-produto');
const btnSalvar = document.getElementById('btn-salvar-produto');
const btnCancelar = document.getElementById('btn-cancelar-edicao');

const tabelaProdutosBody = document.querySelector('#tabela-produtos tbody');
const tabelaRelEstoqueBody = document.querySelector('#tabela-relatorio-estoque tbody');

// Elementos do DOM – retiradas
const tabelaRetiradasBody = document.querySelector('#tabela-retiradas tbody');
const dataInicioInput = document.getElementById('data-inicio');
const dataFimInput = document.getElementById('data-fim');
const btnFiltrarRetiradas = document.getElementById('btn-filtrar-retiradas');
const tabelaRelRetiradasBody = document.querySelector('#tabela-relatorio-retiradas tbody');

// Containers de cards (mobile)
const containerCardsProdutos = document.getElementById('cards-produtos');
const containerCardsRetiradas = document.getElementById('cards-retiradas');

const API_BASE = '/api';
let modoEdicao = false;

/* ---------------------------
   FUNÇÃO: CONSTRÓI CARDS DE PRODUTOS (para mobile)
   Recebe array de produtos e preenche #cards-produtos
*/
function gerarCardsProdutos(produtos) {
  containerCardsProdutos.innerHTML = ''; // limpa
  produtos.forEach((prod) => {
    const dataValidade = new Date(prod.validade).toLocaleDateString('pt-BR');

    const card = document.createElement('div');
    card.classList.add('card');

    // Header (Nome do produto)
    const header = document.createElement('div');
    header.classList.add('card-header');
    header.textContent = `${prod.nome} (ID: ${prod.id})`;
    card.appendChild(header);

    // Linhas com Qtde e Validade
    const rowQtd = document.createElement('div');
    rowQtd.classList.add('card-row');
    rowQtd.innerHTML = `<span class="label">Quantidade:</span> <span class="value">${prod.quantidade}</span>`;
    card.appendChild(rowQtd);

    const rowVal = document.createElement('div');
    rowVal.classList.add('card-row');
    rowVal.innerHTML = `<span class="label">Validade:</span> <span class="value">${dataValidade}</span>`;
    card.appendChild(rowVal);

    // Ações (Editar / Apagar) – só ADMIN vê isso
    const actions = document.createElement('div');
    actions.classList.add('card-actions');

    const btnEdit = document.createElement('button');
    btnEdit.textContent = 'Editar';
    btnEdit.classList.add('btn-edit');
    btnEdit.dataset.id = prod.id;
    btnEdit.addEventListener('click', iniciarEdicaoProduto);
    actions.appendChild(btnEdit);

    const btnDel = document.createElement('button');
    btnDel.textContent = 'Apagar';
    btnDel.classList.add('btn-delete');
    btnDel.dataset.id = prod.id;
    btnDel.addEventListener('click', apagarProduto);
    actions.appendChild(btnDel);

    card.appendChild(actions);

    containerCardsProdutos.appendChild(card);
  });
}

/* ---------------------------
   FUNÇÃO: CONSTRÓI CARDS DE RETIRADAS (para mobile)
   Recebe array de retiradas e preenche #cards-retiradas
*/
function gerarCardsRetiradas(retiradas) {
  containerCardsRetiradas.innerHTML = ''; // limpa
  retiradas.forEach((r) => {
    const dataFormat = new Date(r.data).toLocaleString('pt-BR');

    const card = document.createElement('div');
    card.classList.add('card');

    // Header (Produto + ID da Retirada)
    const header = document.createElement('div');
    header.classList.add('card-header');
    header.textContent = `#${r.id} – ${r.produtoNome}`;
    card.appendChild(header);

    // Linhas: Quantidade + Funcionário + Data
    const rowQtd = document.createElement('div');
    rowQtd.classList.add('card-row');
    rowQtd.innerHTML = `<span class="label">Qtde:</span> <span class="value">${r.quantidade}</span>`;
    card.appendChild(rowQtd);

    const rowUser = document.createElement('div');
    rowUser.classList.add('card-row');
    rowUser.innerHTML = `<span class="label">Funcionário:</span> <span class="value">${r.usuarioNome}</span>`;
    card.appendChild(rowUser);

    const rowData = document.createElement('div');
    rowData.classList.add('card-row');
    rowData.innerHTML = `<span class="label">Data:</span> <span class="value">${dataFormat}</span>`;
    card.appendChild(rowData);

    containerCardsRetiradas.appendChild(card);
  });
}

/* ---------------------------
   CARREGA PRODUTOS e preenche tabela + cards (se mobile)
*/
async function carregarProdutos() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    const produtos = await res.json();

    // Preenche tabela de produtos (desktop)
    tabelaProdutosBody.innerHTML = '';
    tabelaRelEstoqueBody.innerHTML = '';

    produtos.forEach((prod) => {
      const dataValidade = new Date(prod.validade).toLocaleDateString('pt-BR');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${prod.id}</td>
        <td>${prod.nome}</td>
        <td>${prod.quantidade}</td>
        <td>${dataValidade}</td>
        <td>
          <button class="btn-editar" data-id="${prod.id}">Editar</button>
          <button class="btn-apagar" data-id="${prod.id}">Apagar</button>
        </td>
      `;
      tabelaProdutosBody.appendChild(tr);

      if (prod.quantidade > 0) {
        const tr2 = document.createElement('tr');
        tr2.innerHTML = `
          <td>${prod.id}</td>
          <td>${prod.nome}</td>
          <td>${prod.quantidade}</td>
          <td>${dataValidade}</td>
        `;
        tabelaRelEstoqueBody.appendChild(tr2);
      }
    });

    // Configura botões (desktop)
    document.querySelectorAll('.btn-editar').forEach((btn) => {
      btn.addEventListener('click', iniciarEdicaoProduto);
    });
    document.querySelectorAll('.btn-apagar').forEach((btn) => {
      btn.addEventListener('click', apagarProduto);
    });

    // Se for mobile (tela < 768px), gera cards
    if (window.innerWidth <= 768) {
      gerarCardsProdutos(produtos);
    }
  } catch (err) {
    console.error('Erro ao carregar produtos:', err);
  }
}

/* ---------------------------
   CARREGA RETIRADAS (com filtro) e preenche tabela + cards (se mobile)
*/
async function carregarRetiradas(startDate, endDate) {
  try {
    let url = `${API_BASE}/retiradas`;
    if (startDate && endDate) {
      url += `?start=${startDate}&end=${endDate}`;
    } else {
      const hoje = new Date();
      const ano = hoje.getFullYear();
      const mes = String(hoje.getMonth() + 1).padStart(2, '0');
      const dia = String(hoje.getDate()).padStart(2, '0');
      const dataHoje = `${ano}-${mes}-${dia}`;
      url += `?start=${dataHoje}&end=${dataHoje}`;
    }

    const res = await fetch(url);
    const retiradas = await res.json();

    // Preenche tabela de retiradas (desktop)
    tabelaRetiradasBody.innerHTML = '';
    tabelaRelRetiradasBody.innerHTML = '';

    retiradas.forEach((r) => {
      const dataFormat = new Date(r.data).toLocaleString('pt-BR');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.produtoNome}</td>
        <td>${r.quantidade}</td>
        <td>${r.usuarioNome}</td>
        <td>${dataFormat}</td>
      `;
      tabelaRetiradasBody.appendChild(tr);

      const tr2 = document.createElement('tr');
      tr2.innerHTML = `
        <td>${r.id}</td>
        <td>${r.produtoNome}</td>
        <td>${r.quantidade}</td>
        <td>${r.usuarioNome}</td>
        <td>${dataFormat}</td>
      `;
      tabelaRelRetiradasBody.appendChild(tr2);
    });

    // Se for mobile, gera cards de retiradas
    if (window.innerWidth <= 768) {
      gerarCardsRetiradas(retiradas);
    }
  } catch (err) {
    console.error('Erro ao carregar retiradas:', err);
  }
}

/* ---------------------------
   Submeter formulário de produto (Criar ou Atualizar)
*/
formAddProduto.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nome = nomeInput.value.trim();
  const quantidade = parseInt(qtdeInput.value, 10);
  const validade = validadeInput.value;

  if (!nome) {
    alert('Informe o nome do produto.');
    return;
  }
  if (isNaN(quantidade) || quantidade < 0) {
    alert('Informe uma quantidade válida (número ≥ 0).');
    return;
  }
  if (!validade) {
    alert('Informe a data de validade.');
    return;
  }
  const dt = new Date(validade);
  if (isNaN(dt.getTime())) {
    alert('Validade inválida.');
    return;
  }

  if (!modoEdicao) {
    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, quantidade, validade }),
      });
      if (!res.ok) {
        const body = await res.json();
        alert('Erro ao criar produto: ' + (body.error || res.statusText));
        return;
      }
    } catch (fetchErr) {
      console.error('Erro de rede ao criar produto:', fetchErr);
      alert('Falha de rede ao criar produto.');
      return;
    }
  } else {
    const id = produtoIdInput.value;
    try {
      const res = await fetch(`${API_BASE}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, quantidade, validade }),
      });
      if (!res.ok) {
        const body = await res.json();
        alert('Erro ao atualizar produto: ' + (body.error || res.statusText));
        return;
      }
    } catch (fetchErr) {
      console.error('Erro de rede ao atualizar produto:', fetchErr);
      alert('Falha de rede ao atualizar produto.');
      return;
    }
    modoEdicao = false;
    btnCancelar.style.display = 'none';
    produtoIdInput.value = '';
  }

  formAddProduto.reset();
  carregarProdutos();
  carregarGrafico();
  carregarRetiradas(); // atualizar histórico de hoje
});

/* ---------------------------
   Inicia edição de produto (preenche form)
*/
async function iniciarEdicaoProduto(e) {
  const id = e.target.dataset.id;
  const res = await fetch(`${API_BASE}/products/${id}`);
  const prod = await res.json();

  produtoIdInput.value = prod.id;
  nomeInput.value = prod.nome;
  qtdeInput.value = prod.quantidade;

  const dt = new Date(prod.validade);
  const ano = dt.getFullYear();
  const mes = String(dt.getMonth() + 1).padStart(2, '0');
  const dia = String(dt.getDate()).padStart(2, '0');
  validadeInput.value = `${ano}-${mes}-${dia}`;

  modoEdicao = true;
  btnCancelar.style.display = 'inline-block';
}

/* ---------------------------
   Cancelar edição
*/
btnCancelar.addEventListener('click', () => {
  modoEdicao = false;
  produtoIdInput.value = '';
  formAddProduto.reset();
  btnCancelar.style.display = 'none';
});

/* ---------------------------
   Apagar produto
*/
async function apagarProduto(e) {
  const id = e.target.dataset.id;
  if (confirm(`Deseja realmente apagar o produto de ID ${id}?`)) {
    await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
    carregarProdutos();
    carregarGrafico();
    carregarRetiradas();
  }
}

/* ---------------------------
   Carrega gráficos de produtos mais retirados
*/
async function carregarGrafico() {
  try {
    const resRet = await fetch(`${API_BASE}/retiradas`);
    const retiradas = await resRet.json();

    const contagem = {};
    retiradas.forEach((r) => {
      if (!contagem[r.produtoNome]) {
        contagem[r.produtoNome] = 0;
      }
      contagem[r.produtoNome] += r.quantidade;
    });

    const labels = Object.keys(contagem);
    const dataValues = labels.map((lab) => contagem[lab]);

    const ctx = document.getElementById('chart-mais-retirados').getContext('2d');
    if (window.meuGrafico) {
      window.meuGrafico.destroy();
    }
    window.meuGrafico = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Quantidade Retirada',
            data: dataValues,
            backgroundColor: 'rgba(52, 152, 219, 0.6)',
            borderColor: 'rgba(41, 128, 185, 0.8)',
            borderWidth: 1
          }
        ]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  } catch (err) {
    console.error('Erro ao carregar gráfico:', err);
  }
}

/* ---------------------------
   Filtrar retiradas ao clicar no botão
*/
btnFiltrarRetiradas.addEventListener('click', () => {
  const start = dataInicioInput.value;
  const end = dataFimInput.value;

  if (!start || !end) {
    alert('Informe ambas as datas para filtrar.');
    return;
  }
  if (end < start) {
    alert('A data fim não pode ser anterior à data início.');
    return;
  }

  carregarRetiradas(start, end);
});

/* ---------------------------
   Inicialização ao carregar a página
*/
window.addEventListener('load', () => {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  const dataHoje = `${ano}-${mes}-${dia}`;

  dataInicioInput.value = dataHoje;
  dataFimInput.value = dataHoje;

  carregarProdutos();
  carregarGrafico();
  carregarRetiradas(dataHoje, dataHoje);
});

// Adicionamos um event listener para redimensionar a janela
// e, se estivermos em mobile, recriar os cards quando necessário.
window.addEventListener('resize', () => {
  // Apenas se estivermos abaixo de 769px
  if (window.innerWidth <= 768) {
    // Regenera cards com os últimos dados existêntes
    // (podemos simplesmente chamar novamente as funções, pois elas recriam tudo)
    carregarProdutos();
    const start = dataInicioInput.value;
    const end = dataFimInput.value;
    carregarRetiradas(start, end);
  }
});
