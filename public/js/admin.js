// public/js/admin.js

// Elementos do DOM
const formAddProduto = document.getElementById('form-add-produto');
const produtoIdInput = document.getElementById('produto-id');
const nomeInput = document.getElementById('nome-produto');
const qtdeInput = document.getElementById('qtde-produto');
const validadeInput = document.getElementById('validade-produto');
const btnSalvar = document.getElementById('btn-salvar-produto');
const btnCancelar = document.getElementById('btn-cancelar-edicao');

const tabelaProdutosBody = document.querySelector('#tabela-produtos tbody');
const tabelaRetiradasBody = document.querySelector('#tabela-retiradas tbody');

const tabelaRelEstoqueBody = document.querySelector('#tabela-relatorio-estoque tbody');
const tabelaRelRetiradasBody = document.querySelector('#tabela-relatorio-retiradas tbody');

const API_BASE = '/api';

// Estado interno para saber se estamos em edição
let modoEdicao = false;

// ---------------------------
// Função: Listar produtos
// ---------------------------
async function carregarProdutos() {
  const res = await fetch(`${API_BASE}/products`);
  const produtos = await res.json();

  tabelaProdutosBody.innerHTML = '';
  tabelaRelEstoqueBody.innerHTML = ''; // para relatório de estoque
  produtos.forEach((prod) => {
    // Preenche tabela de produtos (admin)
    const tr = document.createElement('tr');
    const dataValidade = new Date(prod.validade).toLocaleDateString('pt-BR');
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

    // Preenche relatório de estoque atual (somente quantidade > 0)
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

  // Adiciona event listeners aos botões de Editar/Apagar
  document.querySelectorAll('.btn-editar').forEach((btn) => {
    btn.addEventListener('click', iniciarEdicaoProduto);
  });
  document.querySelectorAll('.btn-apagar').forEach((btn) => {
    btn.addEventListener('click', apagarProduto);
  });
}

// ---------------------------
// Função: Listar retiradas
// ---------------------------
async function carregarRetiradas() {
  const res = await fetch(`${API_BASE}/retiradas`);
  const retiradas = await res.json();

  tabelaRetiradasBody.innerHTML = '';
  tabelaRelRetiradasBody.innerHTML = ''; // para relatório de retiradas
  retiradas.forEach((r) => {
    const dataFormat = new Date(r.data).toLocaleString('pt-BR');
    // Preenche tabela de retiradas (admin)
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.produtoNome}</td>
      <td>${r.quantidade}</td>
      <td>${r.usuarioNome}</td>
      <td>${dataFormat}</td>
    `;
    tabelaRetiradasBody.appendChild(tr);

    // Preenche relatório de retiradas
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
}

// ---------------------------
// Função: Submete formulário (Criar ou Atualizar)
// ---------------------------
formAddProduto.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nome = nomeInput.value.trim();
  const quantidade = parseInt(qtdeInput.value, 10);
  const validade = validadeInput.value; // "YYYY-MM-DD"

  if (!nome) {
    alert('Informe o nome do produto.');
    return;
  }
  if (isNaN(quantidade) || quantidade < 0) {
    alert('Informe uma quantidade válida (número ≥ 0).');
    return;
  }
  if (!validade) {
    alert('Informe a validade.');
    return;
  }
  const dt = new Date(validade);
  if (isNaN(dt.getTime())) {
    alert('Validade inválida.');
    return;
  }

  if (!modoEdicao) {
    // → Criar produto
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
    // → Atualizar produto
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
  carregarRetiradas();
});

// ---------------------------
// Função: Iniciar edição
// ---------------------------
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

// ---------------------------
// Função: Cancelar edição
// ---------------------------
btnCancelar.addEventListener('click', () => {
  modoEdicao = false;
  produtoIdInput.value = '';
  formAddProduto.reset();
  btnCancelar.style.display = 'none';
});

// ---------------------------
// Função: Apagar produto
// ---------------------------
async function apagarProduto(e) {
  const id = e.target.dataset.id;
  if (confirm(`Deseja realmente apagar o produto de ID ${id}?`)) {
    await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
    carregarProdutos();
    carregarGrafico();
    carregarRetiradas();
  }
}

// ---------------------------
// Função: Carregar Gráfico de Produtos mais Retirados
// ---------------------------
async function carregarGrafico() {
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
}

// ---------------------------
// Inicialização ao carregar a página
// ---------------------------
window.addEventListener('load', () => {
  carregarProdutos();
  carregarRetiradas();
  carregarGrafico();
});
