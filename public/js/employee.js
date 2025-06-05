const selectProdutos = document.getElementById('select-produtos');
const tabelaEstoqueBody = document.querySelector('#tabela-estoque tbody');
const formRetirar = document.getElementById('form-retirar');

const API_BASE = '/api';

// ---------------------------
// Carrega lista de produtos no select e na tabela
async function carregarEstoque() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) {
      console.error('Erro ao buscar produtos:', res.statusText);
      return;
    }
    const produtos = await res.json();

    // Preenche o <select>
    selectProdutos.innerHTML = '<option value="" disabled selected>Selecione um produto</option>';
    // Preenche tabela de estoque
    tabelaEstoqueBody.innerHTML = '';

    produtos.forEach((prod) => {
      const dataVal = new Date(prod.validade).toLocaleDateString('pt-BR');

      // item do select
      const opt = document.createElement('option');
      opt.value = prod.id;
      opt.textContent = `${prod.nome} (Disponível: ${prod.quantidade}, Validade: ${dataVal})`;
      selectProdutos.appendChild(opt);

      // linha da tabela
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${prod.id}</td>
        <td>${prod.nome}</td>
        <td>${prod.quantidade}</td>
        <td>${dataVal}</td>
      `;
      tabelaEstoqueBody.appendChild(tr);
    });
  } catch (err) {
    console.error('Erro de rede ao carregar estoque:', err);
  }
}

// ---------------------------
// Quando o formulário de retirada for enviado
formRetirar.addEventListener('submit', async (e) => {
  e.preventDefault();

  const produtoId = selectProdutos.value;
  const quantidade = parseInt(document.getElementById('qtde-retirar').value, 10);

  if (!produtoId) {
    alert('Selecione um produto.');
    return;
  }
  if (isNaN(quantidade) || quantidade <= 0) {
    alert('Informe uma quantidade válida (número > 0).');
    return;
  }

  try {
    // 1) Primeiro buscamos o produto para verificar estoque disponível
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

    // 2) Agora chamamos a rota POST /api/retiradas, que já faz o decremento internamente
    const resRetirada = await fetch(`${API_BASE}/retiradas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produtoId: produto.id, quantidade }),
    });
    if (!resRetirada.ok) {
      const body = await resRetirada.json();
      alert('Erro ao registrar retirada: ' + (body.error || resRetirada.statusText));
      return;
    }

    alert('Retirada registrada com sucesso!');
    formRetirar.reset();
    await carregarEstoque();
  } catch (err) {
    console.error('Erro de rede ao registrar retirada:', err);
    alert('Falha de rede ao registrar retirada.');
  }
});

// ---------------------------
// Carrega tudo ao abrir a página
window.addEventListener('load', () => {
  carregarEstoque();
});
