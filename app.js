// app.js

// CONFIGURAÇÃO DO SEU FIREBASE (Substitua com suas credenciais oficiais do Firebase Console)
const firebaseConfig = {
    apiKey: "AIzaSyD5VJ5pdgBXRD3ODIsbhO9jJcOZ2MnR-3E",
    authDomain: "kits-opl.firebaseapp.com",
    databaseURL: "https://kits-opl-default-rtdb.firebaseio.com",
    projectId: "kits-opl",
    storageBucket: "kits-opl.firebasestorage.app",
    messagingSenderId: "493713565781",
    appId: "1:493713565781:web:f40dc124537e344bc80cdc"
};

// Inicialização estável do Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();
const auth = firebase.auth();

// Banco de Ícones e Texto de Gatilhos
const TriggersMap = {
    urgency: `<span class="marketing-badge"><i class="fa-solid fa-fire-flame-curved"></i> Últimas Unidades!</span>`,
    countdown: `<span class="marketing-badge"><i class="fa-solid fa-hourglass-half"></i> Expira em breve!</span>`,
    exclusive: `<span class="marketing-badge"><i class="fa-solid fa-gem"></i> Recomendado pela Comunidade</span>`
};

// Cache local de produtos estruturados em JSON
let localProductsCache = {};

// ========================================================
// CAPTURA AUTOMÁTICA DO ENTER PARA LOGIN
// ========================================================
document.getElementById('login-modal').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Impede envios colaterais
        loginAdmin();
    }
});

// ========================================================
// COMPORTAMENTO INTERFACE MÓDULOS & MODAIS
// ========================================================

function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.toggle('hidden');
}

function closeProductModal() {
    toggleModal('product-modal');
    // Reseta o estado interno do formulário após fechar
    document.getElementById('product-form').reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('modal-product-title').innerHTML = `<i class="fa-solid fa-square-plus"></i> CADASTRAR NOVO ANÚNCIO`;
    document.getElementById('btn-save-product').innerText = "PUBLICAR ANÚNCIO";
}

// Escuta a autenticação e reestrutura o DOM
auth.onAuthStateChanged((user) => {
    if (user) {
        document.body.classList.add('admin-logged');
    } else {
        document.body.classList.remove('admin-logged');
        // Fecha as telas administrativas caso deslogue abruptamente
        document.getElementById('product-modal').classList.add('hidden');
        document.getElementById('dashboard-modal').classList.add('hidden');
    }
    renderProducts();
});

// ========================================================
// SISTEMA DE ENVIO E LOADING DA CONTA (UX SOLICITADA)
// ========================================================

function loginAdmin() {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    const loginBtn = document.getElementById('btn-submit-login');
    
    if(!email || !password) {
        alert("Preencha todos os campos do terminal de acesso!");
        return;
    }

    // FEEDBACK VISUAL: Ativa estado de carregamento "LOGANDO..."
    loginBtn.innerText = "LOGANDO...";
    loginBtn.disabled = true;
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            toggleModal('login-modal');
        })
        .catch(error => {
            alert("Falha no acesso à Área Admin: " + error.message);
        })
        .finally(() => {
            // Retorna o botão ao estado padrão após a resposta do servidor
            loginBtn.innerText = "ENTRAR NO SISTEMA";
            loginBtn.disabled = false;
            document.getElementById('admin-email').value = '';
            document.getElementById('admin-password').value = '';
        });
}

function logoutAdmin() {
    if(confirm("Deseja encerrar a sessão de controle administrativo?")) {
        auth.signOut();
    }
}

// ========================================================
// SALVAMENTO / EDIÇÃO NO REALTIME DATABASE (JSON)
// ========================================================

document.getElementById('product-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const prodId = document.getElementById('prod-id').value;
    
    const payloadAnuncio = {
        title: document.getElementById('prod-title').value,
        image: document.getElementById('prod-img').value,
        description: document.getElementById('prod-desc').value,
        price: document.getElementById('prod-price').value,
        link: document.getElementById('prod-link').value,
        trigger: document.getElementById('prod-trigger').value
    };

    if (prodId) {
        // Modo Edição: Sobrescreve a chave JSON existente
        database.ref(`produtos/${prodId}`).set(payloadAnuncio)
            .then(() => {
                alert('Anúncio atualizado no banco de dados!');
                closeProductModal();
            })
            .catch(err => alert('Erro na atualização do JSON: ' + err.message));
    } else {
        // Modo Cadastro: Gera um novo ID e empurra objeto JSON
        database.ref('produtos').push(payloadAnuncio)
            .then(() => {
                alert('Anúncio adicionado com sucesso!');
                closeProductModal();
            })
            .catch(err => alert('Erro ao salvar no banco: ' + err.message));
    }
});

// Abre o formulário preenchendo os dados do item selecionado
function openEditMode(productId) {
    const item = localProductsCache[productId];
    if (!item) return;

    document.getElementById('prod-id').value = productId;
    document.getElementById('prod-title').value = item.title;
    document.getElementById('prod-img').value = item.image;
    document.getElementById('prod-desc').value = item.description;
    document.getElementById('prod-price').value = item.price;
    document.getElementById('prod-link').value = item.link;
    document.getElementById('prod-trigger').value = item.trigger;

    // Adapta o modal esteticamente para modo de Edição
    document.getElementById('modal-product-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> EDITAR ANÚNCIO SELECIONADO`;
    document.getElementById('btn-save-product').innerText = "SALVAR ALTERAÇÕES";
    
    // Garante abertura do modal correspondente
    document.getElementById('product-modal').classList.remove('hidden');
}

function deleteProduct(productId) {
    if(confirm("Deseja remover permanentemente este anúncio da base de dados?")) {
        database.ref(`produtos/${productId}`).remove()
            .then(() => alert("Item deletado do JSON com sucesso!"))
            .catch(error => alert("Erro ao deletar: " + error.message));
    }
}

// ========================================================
// SINCRONIZAÇÃO EM TEMPO REAL E RENDERIZAÇÃO DAS DUAS TELAS
// ========================================================

function renderProducts() {
    const mainGrid = document.getElementById('products-grid');
    const tableBody = document.getElementById('admin-table-body');
    
    database.ref('produtos').off();
    database.ref('produtos').on('value', (snapshot) => {
        mainGrid.innerHTML = '';
        tableBody.innerHTML = '';
        
        const data = snapshot.val();
        localProductsCache = data || {}; // Atualiza o cache local
        
        const isAdmin = document.body.classList.contains('admin-logged');
        
        if (data) {
            Object.keys(data).forEach((id) => {
                const item = data[id];
                const badge = TriggersMap[item.trigger] || '';
                
                // 1. Injeção de Controles nos Cards Principais (Mosaico)
                let cardControls = '';
                if(isAdmin) {
                    cardControls = `
                        <div class="admin-card-controls">
                            <button class="card-action-btn edit" onclick="openEditMode('${id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                            <button class="card-action-btn delete" onclick="deleteProduct('${id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    `;
                }

                const cardHTML = `
                    <div class="product-card">
                        ${cardControls}
                        <img src="${item.image}" alt="${item.title}" loading="lazy">
                        <div class="product-info">
                            ${badge}
                            <h3>${item.title}</h3>
                            <p>${item.description}</p>
                            <div class="price">R$ ${parseFloat(item.price).toFixed(2)}</div>
                            <a href="${item.link}" target="_blank" class="buy-btn">Comprar Agora</a>
                        </div>
                    </div>
                `;
                mainGrid.innerHTML += cardHTML;

                // 2. Injeção de Linhas no Menu Próprio (Tabela de Gerenciamento Geral)
                const triggerText = item.trigger !== 'none' ? item.trigger.toUpperCase() : 'NENHUM';
                const rowHTML = `
                    <tr>
                        <td><img src="${item.image}"></td>
                        <td><strong>${item.title}</strong></td>
                        <td style="color:#00ff66;">R$ ${parseFloat(item.price).toFixed(2)}</td>
                        <td><span style="font-size:12px; color:#ff0055;">${triggerText}</span></td>
                        <td>
                            <button class="card-action-btn edit" onclick="toggleModal('dashboard-modal'); openEditMode('${id}')"><i class="fa-solid fa-pen"></i></button>
                            <button class="card-action-btn delete" onclick="deleteProduct('${id}')"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += rowHTML;
            });
        } else {
            mainGrid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#555;">Nenhum anúncio carregado.</p>`;
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#555;">Nenhum registro para exibir.</td></tr>`;
        }
    });
}

// ========================================================
// ENGENHARIA DE IMPORTAÇÃO E EXPORTAÇÃO EM JSON
// ========================================================

function exportDataJSON() {
    if (Object.keys(localProductsCache).length === 0) {
        alert("Não existem anúncios cadastrados para exportação.");
        return;
    }
    
    // Converte os dados salvos em string estruturada JSON
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localProductsCache, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "backup_anuncios_gamer.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importDataJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            if (confirm("Isto irá mesclar os itens importados com seu banco de dados atual. Confirmar?")) {
                // Percorre o arquivo JSON importado e executa uploads em lote para o nó 'produtos'
                Object.keys(importedData).forEach(key => {
                    database.ref('produtos').push(importedData[key]);
                });
                alert("Importação de dados JSON concluída com sucesso!");
                document.getElementById('import-file').value = ''; // Reseta input
            }
        } catch (err) {
            alert("Erro crítico: Arquivo JSON inválido ou corrompido. " + err.message);
        }
    };
    reader.readAsText(file);
}
