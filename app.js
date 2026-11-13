/** BookLending v1 - reusable vanilla JavaScript library.
 * API: new BookLending.Store(key), BookLending.mount(root), BookLending.status(loan).
 * Data stays in localStorage; no server or third-party dependencies.
 */
(function (global) {
  'use strict';
  const genres = ['Fiction', 'Science', 'History', 'Technology'];
  function today() {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  }
  function status(loan) {
    return loan.returned ? 'Returned' : loan.dueDate < today() ? 'Overdue' : 'On loan';
  }
  class Store {
    constructor(key = 'book-lending-tracker:v1') {
      this.key = key;
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(data) || !data.every(x => x && typeof x.id === 'string' && ['title','author','borrower','dueDate'].every(k => typeof x[k] === 'string') && genres.includes(x.genre))) {
        throw new Error('Saved loans are invalid.');
      }
      this.loans = data;
    }
    save(next) {
      localStorage.setItem(this.key, JSON.stringify(next));
      this.loans = next;
    }
    add(data) {
      const loan = {};
      for (const k of ['title','author','borrower','dueDate','genre']) loan[k] = String(data[k] || '').trim();
      if (!loan.title || !loan.author || !loan.borrower || !/^\d{4}-\d{2}-\d{2}$/.test(loan.dueDate) || !genres.includes(loan.genre)) throw new Error('Please complete all fields.');
      loan.id = crypto.randomUUID(); loan.returned = false;
      this.save([...this.loans, loan]);
      return loan;
    }
    toggle(id) { this.save(this.loans.map(x => x.id === id ? {...x, returned: !x.returned} : x)); }
    remove(id) { this.save(this.loans.filter(x => x.id !== id)); }
  }
  function mount(root) {
    const find = s => root.querySelector(s);
    const form = find('[data-loan-form]');
    const message = find('[data-message]');
    let store;
    try { store = new Store(); }
    catch (error) {
      message.textContent = 'Saved loans could not be loaded. Check browser storage permissions or saved data before continuing.';
      form.querySelector('button').disabled = true;
      return null;
    }
    const body = find('[data-loans]');
    const search = find('[data-search]');
    function render() {
      const loans = store.loans;
      find('[data-total]').textContent = loans.length;
      find('[data-active]').textContent = loans.filter(x => !x.returned).length;
      find('[data-overdue]').textContent = loans.filter(x => status(x) === 'Overdue').length;
      const term = search.value.trim().toLowerCase();
      const visible = loans.filter(x => [x.title,x.author,x.borrower,x.genre].join(' ').toLowerCase().includes(term));
      body.replaceChildren();
      for (const loan of visible) {
        const row = document.createElement('tr');
        for (const key of ['title','author','borrower','dueDate','genre']) {
          const cell = document.createElement('td');
          cell.textContent = loan[key]; row.append(cell);
        }
        const state = status(loan);
        const statusCell = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'lib-badge' + (state === 'Overdue' ? ' lib-badge-overdue' : state === 'Returned' ? ' lib-badge-returned' : '');
        badge.textContent = state; statusCell.append(badge); row.append(statusCell);
        const actions = document.createElement('td');
        const group = document.createElement('div'); group.className = 'lib-actions';
        for (const action of ['toggle','delete']) {
          const button = document.createElement('button');
          button.type = 'button'; button.dataset.action = action; button.dataset.id = loan.id;
          button.className = 'lib-button lib-button-small' + (action === 'delete' ? ' lib-button-quiet' : '');
          button.textContent = action === 'delete' ? 'Delete' : loan.returned ? 'Lend again' : 'Mark returned';
          button.setAttribute('aria-label', button.textContent + ': ' + loan.title);
          group.append(button);
        }
        actions.append(group); row.append(actions); body.append(row);
      }
      const empty = find('[data-empty]');
      empty.hidden = visible.length > 0;
      empty.textContent = loans.length ? 'No loans match your search.' : 'No loans yet. Share a book to start your lending shelf.';
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      try {
        store.add(Object.fromEntries(new FormData(form)));
        form.reset(); message.textContent = 'Loan added. Happy sharing!'; render();
      } catch (error) { message.textContent = 'Could not save loan. ' + error.message; }
    });
    body.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      try {
        if (button.dataset.action === 'delete') {
          if (!global.confirm('Delete this loan from your lending shelf?')) return;
          store.remove(button.dataset.id); message.textContent = 'Loan deleted.';
        } else {
          store.toggle(button.dataset.id); message.textContent = 'Loan status updated.';
        }
        render();
      } catch (error) { message.textContent = 'Changes could not be saved. Check browser storage permissions.'; }
    });
    search.addEventListener('input', render);
    global.addEventListener('focus', render);
    global.setInterval(render, 60000);
    render();
    return {store, render};
  }
  global.BookLending = Object.freeze({Store, mount, status});
  document.querySelectorAll('[data-book-tracker]').forEach(mount);
})(window);
