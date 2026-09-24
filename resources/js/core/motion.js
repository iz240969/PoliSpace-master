// Both booking tables use the same interruptible group animation.
const bookingRowAnimations = new WeakMap();

function setBookingGroupExpanded(rows, expanded) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Read current geometry before cancelling in-flight animations or changing layout.
  const states = [...rows].map((row) => ({
    row,
    cells: [...row.querySelectorAll('.dashboard-booking-cell-content')].map((cell) => {
      const style = getComputedStyle(cell);
      return { cell, height: cell.getBoundingClientRect().height, opacity: style.opacity, padding: style.paddingTop };
    }),
  }));
  states.forEach(({ row }) => {
    const previous = bookingRowAnimations.get(row);
    if (previous) previous.forEach((animation) => animation.cancel());
    bookingRowAnimations.delete(row);
    row.style.display = 'table-row';
    row.classList.toggle('is-visible', expanded);
    row.setAttribute('aria-hidden', String(!expanded));
    row.inert = !expanded;
  });
  // Measure the real expanded content, including long names and action controls.
  states.forEach(({ cells }) => cells.forEach((state) => {
    state.targetHeight = state.cell.getBoundingClientRect().height;
    state.targetPadding = getComputedStyle(state.cell).paddingTop;
  }));
  states.forEach(({ row, cells }) => {
    if (reduceMotion || !cells.length || !cells.every(({ cell }) => typeof cell.animate === 'function')) {
      row.style.removeProperty('display');
      return;
    }
    const animations = cells.map(({ cell, height, opacity, padding, targetHeight, targetPadding }) => cell.animate([
      { height: `${height}px`, opacity, paddingTop: padding, paddingBottom: padding },
      { height: `${targetHeight}px`, opacity: expanded ? 1 : 0, paddingTop: targetPadding, paddingBottom: targetPadding },
    ], { duration: 220, easing: 'cubic-bezier(.2, .7, .2, 1)' }));
    bookingRowAnimations.set(row, animations);
    Promise.all(animations.map((animation) => animation.finished)).then(() => {
      // A cancelled collapse must never hide a newly reopened group.
      if (bookingRowAnimations.get(row) !== animations) return;
      bookingRowAnimations.delete(row);
      row.style.removeProperty('display');
    }).catch(() => { /* Cancellation is expected when a group is toggled again. */ });
  });
}
