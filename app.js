// app.js

// CONFIGURAÇÃO DO SEU FIREBASE (Substitua pelos dados gerados no seu painel Firebase)
const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SUA_APP_ID"
};

// Inicialização segura do Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();
const auth = firebase.auth();

// Controle dos gatilhos de Marketing / Escassez
const TriggersMap = {
    urgency: `<span class="marketing-badge"><i class="fa-solid fa-fire-flame-curved"></i> Últimas Unidades!</span>`,
    countdown: `<span class="marketing-badge"><i class="fa-solid fa-hourglass-half"></i> Expira em breve!</span>`,
    exclusive: `<span class="marketing-badge"><i class="fa-solid fa-gem"></i> Recomendado pela Comunidade</span>`
};

// ========================================================
// CONTROLE DE INTERFACE (MODAIS E ESTADOS)
// ========================================================

// Abre e fecha os modais da página única
function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.toggle('hidden');
}

// Event Listeners dos botões de abrir os modais
document.getElementById('btn-open-login').addEventListener('click', () => toggleModal('login-modal'));
document.getElementById('btn-open-panel').addEventListener('click', () => toggleModal('product-modal'));

// Escuta o status do login no Firebase e atualiza o DOM instantaneamente
auth.onAuthStateChanged((user) => {
    if (user) {
        document.body.classList.add('admin-logged');
    } else {
        document.body.classList.remove('admin-logged');
    }
    // Re-renderiza os produtos para injetar/remover botões administrativos (Deletar)
    renderProducts();
});

// ========================================================
// REQUISIÇÕES E LOGIN FIREBASE AUTH
// ========================================================

function loginAdmin() {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            toggleModal('login-modal');
            // Limpa os campos após login correto
            document.getElementById('admin-email').value = '';
            document.getElementById('admin-password').value = '';
        })
        .catch(error => alert("Falha na autenticação gamer: " + error.message));
}

function logoutAdmin() {
    if(confirm("Deseja mesmo sair do Painel de Controle?")) {
        auth.signOut();
    }
}

// ========================================================
// GERENCIAMENTO DOS PRODUTOS (REALTIME DATABASE)
// ========================================================

// Salvar Item via JSON push
document.getElementById('product-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const novoAnuncio = {
        title: document.getElementById('prod-title').value,
        image: document.getElementById('prod-img').value,
        description: document.getElementById('prod-desc').value,
        price: document.getElementById('prod-price').value,
        link: document.getElementById('prod-link').value,
        trigger: document.getElementById('prod-trigger').value
    };

    database.ref('produtos').push(novoAnuncio)
        .then(() => {
            alert('Anúncio cadastrado e sincronizado com sucesso!');
            document.getElementById('product-form').reset();
            toggleModal('product-modal'); // Fecha o formulário
        })
        .catch(error => alert('Erro crítico ao salvar dados: ' + error.message));
});

// Função para deletar um anúncio diretamente do layout (Só funciona se logado)
function deleteProduct(productId) {
    if(confirm("Tem certeza que quer remover permanentemente este anúncio do banco?")) {
        database.ref(`produtos/${productId}`).remove()
            .then(() => alert("Item excluído!"))
            .catch(error => alert("Erro ao excluir: " + error.message));
    }
}

// Carregar e listar os anúncios em tempo real
function renderProducts() {
    const grid = document.getElementById('products-grid');
    
    database.ref('produtos').off(); // Evita duplicação de escuta
    database.ref('produtos').on('value', (snapshot) => {
        grid.innerHTML = '';
        const items = snapshot.val();
        const isAdmin = document.body.classList.contains('admin-logged');
        
        if (items) {
            Object.keys(items).forEach((id) => {
                const item = items[id];
                const badge = TriggersMap[item.trigger] || '';
                
                // Botão de deletar renderizado condicionalmente
                const deleteBtn = isAdmin ? `<button class="delete-prod-btn" onclick="deleteProduct('${id}')"><i class="fa-solid fa-trash"></i></button>` : '';

                const cardHTML = `
                    <div class="product-card">
                        ${deleteBtn}
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
                grid.innerHTML += cardHTML;
            });
        } else {
            grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #666;">Nenhum anúncio disponível no setup.</p>`;
        }
    });
}
