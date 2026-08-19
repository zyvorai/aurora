/* SalesPulse CRM – drag-and-drop pipeline + toasts */

function toast(msg, type) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast' + (type ? ' ' + type : '');
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 2800);
}

function initKanban() {
  let dragCard = null;

  document.querySelectorAll('.kanban-card[draggable]').forEach(card => {
    card.addEventListener('dragstart', e => {
      dragCard = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.dealId || '');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
      dragCard = null;
    });
  });

  document.querySelectorAll('[data-drop-zone]').forEach(zone => {
    const col = zone.closest('.kanban-col');

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (col) col.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget) && col) col.classList.remove('drag-over');
    });
    zone.addEventListener('drop', async e => {
      e.preventDefault();
      if (col) col.classList.remove('drag-over');
      if (!dragCard) return;

      const dealId = dragCard.dataset.dealId;
      const newStage = zone.dataset.dropZone;
      const oldStage = dragCard.dataset.stage;
      if (!dealId || !newStage || newStage === oldStage) return;

      const emptyHint = zone.querySelector('.drop-hint');
      if (emptyHint) emptyHint.remove();
      zone.appendChild(dragCard);
      dragCard.dataset.stage = newStage;
      updateCounts();

      // Use form POST so it works without API key
      const form = new FormData();
      form.append('stage', newStage);
      if (newStage === 'lost') form.append('lost_reason', 'Other');

      try {
        const res = await fetch('/deals/' + dealId + '/stage', {
          method: 'POST',
          body: form,
          redirect: 'manual'
        });
        // 303/302 is success for form handlers
        if (res.status >= 400) throw new Error('fail');
        toast('Moved to ' + newStage, 'success');
        dragCard.classList.remove('won', 'lost', 'overdue', 'stale', 'hot');
        if (newStage === 'won') dragCard.classList.add('won');
        if (newStage === 'lost') dragCard.classList.add('lost');
      } catch (err) {
        toast('Could not update stage — reloading', 'error');
        setTimeout(() => location.reload(), 1000);
      }
    });
  });
}

function updateCounts() {
  document.querySelectorAll('.kanban-col').forEach(col => {
    const zone = col.querySelector('[data-drop-zone]');
    const countEl = col.querySelector('.count');
    if (!zone || !countEl) return;
    countEl.textContent = zone.querySelectorAll('.kanban-card').length;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initKanban();
});
