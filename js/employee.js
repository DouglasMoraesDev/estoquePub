// public/js/employee.js

const selectProdutos = document.getElementById('select-produtos');
const tabelaEstoqueBody = document.querySelector('#tabela-estoque tbody');
const formRetirar = document.getElementById('form-retirar');

const API_BASE = '/api';

// ---------------------------
// Função: Carregar Estoque (lista produtos)

async function carregarEstoque() {
  const res = await fetch(`${API_BASE}/products`);
  const produtos = await res.json();

  // Preencher select de produtos
  selectProdutos.innerHTML = '<option value="" disabled selected>Selecione um produto</option>';
  tabelaEstoqueBody.innerHTML = '';

  produtos.forEach((prod) => {
    const dataVal = new Date(prod.validade).toLocaleDateString('pt-BR');
    // Preenche select
    const opt = document.createElement('option');
    opt.value = prod.id;
    opt.textContent = `${prod.nome} (Disponível: ${prod.quantidade} ${prod.unidade}, Validade: ${dataVal})`;
    selectProdutos.appendChild(opt);

    // Preenche tabela de estoque
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${prod.id}</td>
      <td>${prod.nome}</td>
      <td>${prod.quantidade}</td>
      <td>${prod.unidade}</td>
      <td>${dataVal}</td>
    `;
    tabelaEstoqueBody.appendChild(tr);
  });
}

// ---------------------------
// Função: Registrar Retirada
// ---------------------------
formRetirar.addEventListener('submit', async (e) => {
  e.preventDefault();
  const produtoId = selectProdutos.value;
  const quantidade = parseInt(document.getElementById('qtde-retirar').value, 10);

  if (!produtoId || isNaN(quantidade) || quantidade <= 0) {
    alert('Selecione um produto e informe uma quantidade válida.');
    return;
  }

  // 1) busca produto atual para checar estoque
  const resProduto = await fetch(`${API_BASE}/products/${produtoId}`);
  if (!resProduto.ok) {
    alert('Produto não encontrado.');
    return;
  }
  const produto = await resProduto.json();
  if (produto.quantidade < quantidade) {
    alert('Quantidade insuficiente em estoque.');
    return;
  }

  // 2) atualiza estoque (PUT /api/products/:id)
  await fetch(`${API_BASE}/products/${produtoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: produto.nome,
      quantidade: produto.quantidade - quantidade,
      unidade: produto.unidade,
      validade: produto.validade.split('T')[0], // "YYYY-MM-DD"
    }),
  });

  // 3) registra retirada (POST /api/retiradas)
  await fetch(`${API_BASE}/retiradas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ produtoId: produto.id, quantidade }),
  });

  alert('Retirada registrada com sucesso!');
  formRetirar.reset();
  carregarEstoque();
});

// ---------------------------
// Inicialização ao carregar a página
// ---------------------------
window.addEventListener('load', () => {
  carregarEstoque();
});
