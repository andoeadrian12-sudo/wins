
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ykcibycbqhvdkajidqnm.supabase.co";
const SUPABASE_KEY = "sb_publishable_7yZlCDzDq2pnaRRSJH-CLw_KO7ZaEuP";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const login = document.getElementById("login");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

let requestsCache = [];

function showMessage(text) {
    message.textContent = text;
}

function createElement(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text || "";
    if (className) element.className = className;
    return element;
}

// NAVEGAÇÃO
window.showSection = async function(section) {
    document.querySelectorAll("main section").forEach(item => {
        item.classList.add("hidden");
    });

    const selected = document.getElementById(section);

    if (selected) {
        selected.classList.remove("hidden");
    }

    if (section === "overview") await loadOverview();
    if (section === "requests") await loadRequests();
};

// VERIFICAR ADMIN
async function verificarAdmin() {
    const { data: { user }, error: userError } =
        await supabase.auth.getUser();

    if (userError || !user) {
        login.classList.remove("hidden");
        dashboard.classList.add("hidden");
        return false;
    }

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (error || !profile || profile.role !== "admin") {
        await supabase.auth.signOut();

        login.classList.remove("hidden");
        dashboard.classList.add("hidden");

        showMessage("Acesso permitido somente para administradores.");
        return false;
    }

    login.classList.add("hidden");
    dashboard.classList.remove("hidden");

    return true;
}

// BUSCAR SOLICITAÇÕES
async function getRequests() {
    const { data, error } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao buscar solicitações:", error);
        return { data: [], error };
    }

    return { data: data || [], error: null };
}

// VISÃO GERAL
async function loadOverview() {
    const { data, error } = await getRequests();

    if (error) {
        showMessage("Erro ao carregar os dados. Verifique o Supabase.");
        return;
    }

    requestsCache = data;

    const pending = data.filter(item => item.status === "pending");

    const clients = new Set(
        data.map(item => item.client_id || item.client_email)
             .filter(Boolean)
    );

    document.getElementById("pendingCount").textContent =
        pending.length;

    document.getElementById("clientCount").textContent =
        clients.size;

    // A tabela de servidores será criada na próxima etapa.
    document.getElementById("serverCount").textContent = "0";
}

// LISTAR SOLICITAÇÕES
async function loadRequests() {
    const container = document.getElementById("requestsList");

    container.replaceChildren(
        createElement("p", "Carregando solicitações...")
    );

    const { data, error } = await getRequests();

    if (error) {
        container.replaceChildren(
            createElement("p", "Erro ao carregar solicitações: " + error.message)
        );
        return;
    }

    requestsCache = data;
    container.replaceChildren();

    if (data.length === 0) {
        container.appendChild(
            createElement("p", "Nenhuma solicitação encontrada.")
        );
        return;
    }

    data.forEach(request => {
        const card = createElement("div", "", "request-card");

        const title = createElement(
            "h3",
            request.server_name || "Servidor sem nome"
        );

        const email = createElement(
            "p",
            "Cliente: " + (request.client_email || "Não informado")
        );

        const plan = createElement(
            "p",
            "Plano: " + (request.plan || "Não informado")
        );

        const type = createElement(
            "p",
            "Tipo: " + (request.server_type || "Minecraft")
        );

        const statusNames = {
            pending: "Pendente",
            approved: "Aprovada",
            rejected: "Recusada"
        };

        const status = createElement(
            "p",
            "Status: " + (statusNames[request.status] || request.status)
        );

        const date = createElement(
            "p",
            "Data: " + (
                request.created_at
                    ? new Date(request.created_at).toLocaleString("pt-BR")
                    : "Não informada"
            )
        );

        card.append(title, email, plan, type, status, date);

        if (request.status === "pending") {
            const actions = createElement("div", "", "request-actions");

            const approveButton = createElement(
                "button",
                "Aprovar",
                "approve-button"
            );

            const rejectButton = createElement(
                "button",
                "Recusar",
                "reject-button"
            );

            approveButton.addEventListener("click", () => {
                updateRequest(request.id, "approved");
            });

            rejectButton.addEventListener("click", () => {
                updateRequest(request.id, "rejected");
            });

            actions.append(approveButton, rejectButton);
            card.appendChild(actions);
        }

        container.appendChild(card);
    });
}

// APROVAR OU RECUSAR
async function updateRequest(id, newStatus) {
    const confirmation = confirm(
        newStatus === "approved"
            ? "Deseja aprovar esta solicitação?"
            : "Deseja recusar esta solicitação?"
    );

    if (!confirmation) return;

    const { error } = await supabase
        .from("requests")
        .update({ status: newStatus })
        .eq("id", id);

    if (error) {
        alert("Erro ao atualizar: " + error.message);
        console.error(error);
        return;
    }

    alert(
        newStatus === "approved"
            ? "Solicitação aprovada!"
            : "Solicitação recusada!"
    );

    await loadRequests();
    await loadOverview();
}

// LOGIN
loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    showMessage("Verificando acesso...");

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        showMessage("Erro: confira seu e-mail e senha.");
        return;
    }

    const autorizado = await verificarAdmin();

    if (autorizado) {
        showMessage("");
        await window.showSection("overview");
    }
});

// SAIR
window.logout = async function() {
    await supabase.auth.signOut();

    dashboard.classList.add("hidden");
    login.classList.remove("hidden");

    loginForm.reset();
    showMessage("");
};

// INICIALIZAÇÃO
async function init() {
    const autorizado = await verificarAdmin();

    if (autorizado) {
        await window.showSection("overview");
    }
}

init();
