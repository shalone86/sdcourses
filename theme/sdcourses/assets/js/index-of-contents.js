/**
 * Make the 'index of contents' take the position of column 'main' inside content grid
 * Make the control button of 'index of contents' has exact position
 */
function initIndexOfContents() {
  const canvas = document.querySelector('.gh-content.gh-canvas');
  const indexControl = document.querySelector('.index-of-contents-control-container');
  const indexContainer = document.querySelector('.index-of-contents-container.float');
  if (!canvas || !indexControl || !indexContainer) return;

  function setMarginBottom() {
    const previousSibling = indexControl.previousElementSibling;
    if (!previousSibling) return;

    const widthBetween = canvas.getBoundingClientRect().bottom - previousSibling.getBoundingClientRect().bottom;

    indexControl.style.marginBottom = `${widthBetween}px`;
  }

  function setWidthAndLeft() {
    const canvasGrid = window.getComputedStyle(canvas).gridTemplateColumns;
    const [fullLeft, wideLeft, mainWidth] = canvasGrid.match(/[\d.]+px/g);

    const leftWidth = parseInt(fullLeft) + parseInt(wideLeft);
    const contentWidth=  parseFloat(mainWidth);

    indexContainer.style.left = `${leftWidth}px`;
    indexContainer.style.width = `${contentWidth}px`;
  }

  setMarginBottom();
  setWidthAndLeft();

  window.addEventListener('resize', function () {
    setTimeout(() => {
      setMarginBottom();
      setWidthAndLeft();
    }, 250)
  });
}

/* When screen width < 992px, the index control button will show when detect scroll up action */
function handleScroll() {
  const mediaQuery = window.matchMedia('(max-width: 991px)');
  if (!mediaQuery.matches) return;

  const canvas = document.querySelector('.gh-content.gh-canvas');
  const indexControl = document.querySelector('.index-of-contents-control-container');
  if (!canvas || !indexControl) return;

  let lastScrollPosition = 0;
  window.addEventListener('scroll', function() {
    let currentScrollPosition = window.pageYOffset || document.documentElement.scrollTop;

    if (currentScrollPosition < lastScrollPosition) {
      indexControl.classList.remove("invisible");
    } else {
      indexControl.classList.add("invisible");
    }

    lastScrollPosition = currentScrollPosition;
  });
}

/*  Prevent the whole page from scrolling when index container's scrollbar reaches the top/bottom */
function stopScroll() {
  const indexContainer = document.querySelector('.index-of-contents-container.float');

  indexContainer.addEventListener('wheel', function(event) {
    const delta = event.deltaY;
    const atTop = indexContainer.scrollTop === 0;
    const atBottom = indexContainer.scrollTop + indexContainer.clientHeight >= indexContainer.scrollHeight;

    // Prevent scrolling the page when reaching the top or bottom
    if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
      event.preventDefault();
    }
  });
}

export {initIndexOfContents, handleScroll, stopScroll};
