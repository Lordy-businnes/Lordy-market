
// À mettre au début de votre fichier
const PORT = process.env.PORT || 10000;
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
// 1. TA CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyAm6n-l0r4uSRPZI4pnnUsufq2rGHqvEaM",
  authDomain: "lordy-market.firebaseapp.com",
  projectId: "lordy-market",
  storageBucket: "lordy-market.firebasestorage.app",
  messagingSenderId: "777955043590",
  appId: "1:777955043590:web:c018766084faeb681fd687",
  measurementId: "G-KFRWFJ15CM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const productCollection = collection(db, "products");

// 2. ÉLÉMENTS UI (S'ils existent dans la page)
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');
const productList = document.getElementById('productList');
const productForm = document.getElementById('productForm');

// --- 3. GESTION DE L'AUTHENTIFICATION ---

loginBtn?.addEventListener('click', () => signInWithPopup(auth, provider));
logoutBtn?.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        if(loginBtn) loginBtn.style.display = 'none';
        if(userInfo) userInfo.style.display = 'flex';
        if(userName) userName.innerText = user.displayName;
    } else {
        if(loginBtn) loginBtn.style.display = 'block';
        if(userInfo) userInfo.style.display = 'none';
        
        // Sécurité : Rediriger si on tente de vendre sans être connecté
        if (window.location.pathname.includes("vendeur.html")) {
            alert("Connectez-vous avec Google pour accéder à l'espace vendeur !");
            window.location.href = "index.html";
        }
    }
});

// --- 4. AJOUT DE PRODUIT (PARTIE VENDEUR) ---

if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!auth.currentUser) {
            alert("Erreur : Vous devez être connecté !");
            return;
        }

        const btn = productForm.querySelector('button');
        const file = document.getElementById('imageFile').files[0];
        btn.innerText = "Chargement...";
        btn.disabled = true;

        try {
            const storageRef = ref(storage, 'products/' + Date.now() + "_" + file.name);
            const snapshot = await uploadBytes(storageRef, file);
            const photoURL = await getDownloadURL(snapshot.ref);

            await addDoc(productCollection, {
                name: document.getElementById('name').value,
                price: parseFloat(document.getElementById('price').value),
                description: document.getElementById('description').value,
                phone: document.getElementById('phone').value,
                imageUrl: photoURL,
                userId: auth.currentUser.uid, // On lie le produit à l'utilisateur
                createdAt: new Date()
            });

            alert("Produit publié !");
            productForm.reset();
        } catch (err) {
            alert("Erreur : " + err.message);
        } finally {
            btn.innerText = "Mettre en vente";
            btn.disabled = false;
        }
    });
}

// --- 5. AFFICHAGE DES PRODUITS (PARTIE BOUTIQUE) ---

if (productList) {
    const q = query(productCollection, orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        productList.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const p = docSnap.data();
            const pId = docSnap.id;
            const message = encodeURIComponent(`Bonjour, je suis intéressé par : ${p.name}`);
            const whatsappUrl = `https://wa.me/${p.phone}?text=${message}`;

            // Bouton supprimer visible uniquement si c'est NOTRE produit
            const deleteBtn = (auth.currentUser && auth.currentUser.uid === p.userId) 
                ? `<button onclick="deleteProduct('${pId}')" class="delete-btn">Vendu</button>` 
                : "";

            productList.innerHTML += `
                <div class="product-card">
                    <div class="product-image" style="background-image: url('${p.imageUrl}')"></div>
                    <h3>${p.name} <span class="price">${p.price} (HTG)</span></h3>
                    <p>${p.description}</p>
                    <div class="card-buttons">
                        <a href="${whatsappUrl}" target="_blank" class="buy-btn">🛒 Acheter</a>
                        ${deleteBtn}
                    </div>
                </div>
            `;
        });
    });
}

// --- 6. SUPPRESSION ---
window.deleteProduct = async (id) => {
    if (confirm("Marquer comme vendu et supprimer ?")) {
        await deleteDoc(doc(db, "products", id));
    }
};

loginBtn?.addEventListener('click', async (e) => {
    e.preventDefault(); // Empêche le comportement par défaut
    try {
        await signInWithPopup(auth, provider);
        console.log("Connexion réussie !");
    } catch (error) {
        console.error("Erreur détaillée : ", error.code, error.message);
        alert("Erreur de connexion : " + error.message);
    }
});

// --- PARTIE BOUTIQUE (Affichage et Recherche) ---
const list = document.getElementById('productList');
const searchInput = document.getElementById('searchInput');
let allProducts = []; // Cette liste stocke tes produits pour la recherche

if (list) {
    const q = query(productCollection, orderBy("createdAt", "desc"));
    
    // On écoute Firebase
    onSnapshot(q, (snapshot) => {
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts(allProducts); // Affiche tout au début
    });
}

// LA FONCTION DE RECHERCHE (Remplace ton ancien bloc par celui-ci)
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        
        const filtered = allProducts.filter(p => {
            const name = (p.name || "").toLowerCase();
            const desc = (p.description || "").toLowerCase();
            return name.includes(term) || desc.includes(term);
        });

        renderProducts(filtered);
    });
}

// LA FONCTION D'AFFICHAGE (Vérifie qu'elle vide bien la liste)
function renderProducts(products) {
    if (!list) return;
    list.innerHTML = ""; // INDISPENSABLE pour que la recherche nettoie l'écran

    products.forEach((p) => {
        const pId = p.id;
        const message = encodeURIComponent(`Bonjour, je suis intéressé par : ${p.name}`);
        const whatsappUrl = `https://wa.me/${p.phone}?text=${message}`;

        const deleteBtn = (auth.currentUser && auth.currentUser.uid === p.userId) 
            ? `<button onclick="deleteProduct('${pId}')" class="delete-btn">Vendu</button>` 
            : "";

        list.innerHTML += `
            <div class="product-card">
                <div class="product-image" style="background-image: url('${p.imageUrl}')"></div>
                <h3>${p.name} <span class="price">${p.price} HTG</span></h3>
                <p>${p.description}</p>
                <div class="card-buttons">
                    <a href="${whatsappUrl}" target="_blank" class="buy-btn">🛒 Acheter</a>
                    ${deleteBtn}
                </div>
            </div>
        `;
    });
}



// À la fin de votre fichier
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});

