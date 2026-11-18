'use strict';

// Estado da tela: o banco permanece exclusivamente no backend.
const $ = (id) => document.getElementById(id);
const state = {
  users: [],
  editing: null,
  deleting: null,
  saving: false,
  removing: false,
  loading: false,
};
const form = $('user-form');
let toastTimer;

class ApiError extends Error {
  constructor(message, fields = {}) {
    super(message);
    this.fields = fields;
  }
}

// Um único ponto cuida de JSON, status HTTP, rede e tempo limite.
async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError('Não foi possível acessar o servidor. Confira a conexão e tente novamente.');
  }
  if (response.status === 204) return null;
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('O servidor retornou uma resposta inesperada. Tente novamente.');
  }
  if (!response.ok)
    throw new ApiError(data.message || 'Não foi possível concluir a operação.', data.errors);
  return data;
}

function toast(message, error = false) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').classList.toggle('error', error);
  $('toast').hidden = false;
  toastTimer = setTimeout(() => {
    $('toast').hidden = true;
  }, 5500);
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

// textContent protege a tela de HTML inserido nos dados de usuários.
function userRow(user) {
  const row = node('tr');
  const personCell = node('td');
  const person = node('div', undefined, 'person');
  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => [...part][0])
    .join('')
    .toUpperCase();
  const description = node('div');
  description.append(node('strong', user.name), node('small', user.email));
  person.append(node('span', initials, 'avatar'), description);
  personCell.append(person);
  const loginCell = node('td');
  loginCell.append(node('span', user.login, 'login-label'));
  const statusCell = node('td');
  const status = node('span', undefined, `status${user.active ? '' : ' inactive'}`);
  status.append(
    node('span', '', `dot ${user.active ? 'active' : 'inactive'}`),
    document.createTextNode(user.active ? 'Ativo' : 'Inativo'),
  );
  statusCell.append(status);
  const date = new Intl.DateTimeFormat('pt-BR').format(new Date(user.created_at));
  const actionsCell = node('td');
  const actions = node('div', undefined, 'row-actions');
  const edit = node('button', '✎', 'icon-button');
  edit.type = 'button';
  edit.title = `Editar ${user.name}`;
  edit.setAttribute('aria-label', edit.title);
  edit.addEventListener('click', () => openEdit(user.id, edit));
  const remove = node('button', '×', 'icon-button delete');
  remove.type = 'button';
  remove.title = `Excluir ${user.name}`;
  remove.setAttribute('aria-label', remove.title);
  remove.addEventListener('click', () => openDelete(user));
  actions.append(edit, remove);
  actionsCell.append(actions);
  row.append(personCell, loginCell, statusCell, node('td', date), actionsCell);
  return row;
}

function render() {
  const query = $('search').value.trim().toLocaleLowerCase('pt-BR');
  const status = $('status-filter').value;
  const filtered = state.users.filter((user) => {
    const matchesText = [user.name, user.email, user.login].some((value) =>
      value.toLocaleLowerCase('pt-BR').includes(query),
    );
    return matchesText && (status === 'all' || user.active === (status === 'active'));
  });
  $('total-count').textContent = state.users.length;
  $('active-count').textContent = state.users.filter((user) => user.active).length;
  $('inactive-count').textContent = state.users.filter((user) => !user.active).length;
  $('team-count').textContent = state.users.length;
  $('user-rows').replaceChildren(...filtered.map(userRow));
  $('empty').hidden = filtered.length !== 0 || state.loading;
  $('empty-description').textContent = state.users.length
    ? 'Nenhum resultado. Experimente outra busca ou situação.'
    : 'Comece cadastrando a primeira pessoa da equipe.';
  $('result-count').textContent = `${filtered.length} de ${state.users.length} usuários`;
}

async function loadUsers() {
  if (state.loading) return;
  state.loading = true;
  $('loading').hidden = false;
  $('empty').hidden = true;
  $('reload').disabled = true;
  $('list-error').hidden = true;
  document.querySelector('.panel').setAttribute('aria-busy', 'true');
  try {
    state.users = await api('/users');
    state.loading = false;
    render();
  } catch (error) {
    $('user-rows').replaceChildren();
    $('list-error').textContent = `${error.message} Use Atualizar para tentar novamente.`;
    $('list-error').hidden = false;
    for (const id of ['total-count', 'active-count', 'inactive-count']) $(id).textContent = '—';
    $('result-count').textContent = 'Lista indisponível';
  } finally {
    state.loading = false;
    $('loading').hidden = true;
    $('reload').disabled = false;
    document.querySelector('.panel').setAttribute('aria-busy', 'false');
  }
}

function clearErrors() {
  $('form-error').hidden = true;
  for (const key of ['name', 'email', 'login', 'password']) {
    $(`error-${key}`).textContent = '';
    $(key).removeAttribute('aria-invalid');
  }
}

function openForm(user = null) {
  state.editing = user?.id || null;
  form.reset();
  clearErrors();
  for (const key of ['name', 'email', 'login']) $(key).value = user?.[key] || '';
  $('active').checked = user ? user.active : true;
  $('password').required = !user;
  $('password-hint').textContent = user
    ? 'Deixe em branco para manter a senha atual.'
    : 'Use pelo menos 8 caracteres.';
  $('form-title').textContent = user ? 'Editar usuário' : 'Novo usuário';
  $('save-user').textContent = user ? 'Salvar alterações' : 'Cadastrar usuário';
  $('form-description').textContent = user
    ? 'Atualize os dados desta pessoa na equipe.'
    : 'Preencha os dados para adicionar uma pessoa à equipe.';
  $('user-dialog').showModal();
  $('name').focus();
}

async function openEdit(id, button) {
  button.disabled = true;
  button.textContent = '…';
  try {
    openForm(await api(`/users/${encodeURIComponent(id)}`));
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = '✎';
  }
}

function formBusy(busy) {
  state.saving = busy;
  for (const control of form.elements) control.disabled = busy;
  $('save-user').textContent = busy
    ? 'Salvando…'
    : state.editing
      ? 'Salvar alterações'
      : 'Cadastrar usuário';
}

async function saveUser(event) {
  event.preventDefault();
  if (state.saving) return;
  clearErrors();
  if (!form.reportValidity()) return;
  const payload = {
    name: $('name').value.trim(),
    email: $('email').value.trim(),
    login: $('login').value.trim(),
    active: $('active').checked,
  };
  if (!state.editing || $('password').value !== '') payload.password = $('password').value;
  const editing = state.editing;
  formBusy(true);
  try {
    await api(editing ? `/users/${encodeURIComponent(editing)}` : '/users', {
      method: editing ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    $('password').value = '';
    $('user-dialog').close();
    await loadUsers();
    toast(editing ? 'Alterações salvas com sucesso.' : 'Usuário cadastrado com sucesso.');
  } catch (error) {
    $('form-error').textContent = error.message;
    $('form-error').hidden = false;
    for (const [key, message] of Object.entries(error.fields || {})) {
      if ($(`error-${key}`)) {
        $(`error-${key}`).textContent = message;
        $(key).setAttribute('aria-invalid', 'true');
      }
    }
    $('form-error').scrollIntoView({ block: 'nearest' });
  } finally {
    formBusy(false);
  }
}

function openDelete(user) {
  state.deleting = user.id;
  $('delete-description').textContent = `Você está prestes a excluir ${user.name} (${user.email}).`;
  $('delete-error').hidden = true;
  $('delete-dialog').showModal();
  $('cancel-delete').focus();
}

async function deleteUser() {
  if (state.removing) return;
  state.removing = true;
  $('confirm-delete').disabled = $('cancel-delete').disabled = true;
  $('confirm-delete').textContent = 'Excluindo…';
  try {
    await api(`/users/${encodeURIComponent(state.deleting)}`, { method: 'DELETE' });
    $('delete-dialog').close();
    await loadUsers();
    toast('Usuário excluído com sucesso.');
  } catch (error) {
    $('delete-error').textContent = error.message;
    $('delete-error').hidden = false;
  } finally {
    state.removing = false;
    $('confirm-delete').disabled = $('cancel-delete').disabled = false;
    $('confirm-delete').textContent = 'Excluir usuário';
  }
}

// Eventos conectam os controles às funções, sem JavaScript inline no HTML.
$('new-user').addEventListener('click', () => openForm());
$('reload').addEventListener('click', loadUsers);
$('search').addEventListener('input', render);
$('status-filter').addEventListener('change', render);
form.addEventListener('submit', saveUser);
for (const id of ['close-form', 'cancel-form'])
  $(id).addEventListener('click', () => $('user-dialog').close());
$('user-dialog').addEventListener('cancel', (event) => {
  if (state.saving) event.preventDefault();
});
$('user-dialog').addEventListener('close', () => {
  $('password').value = '';
});
$('cancel-delete').addEventListener('click', () => $('delete-dialog').close());
$('confirm-delete').addEventListener('click', deleteUser);
$('delete-dialog').addEventListener('cancel', (event) => {
  if (state.removing) event.preventDefault();
});
loadUsers();
