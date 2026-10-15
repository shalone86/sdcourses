import tocbot from 'tocbot';

function initToc() {
  tocbot.init({
    tocSelector: '.toc',
    contentSelector: '.gh-content',
    headingSelector: "h1, h2, h3",
    ignoreSelector: ".kg-card *,.gh-author-name,.gh-post-upgrade-cta *",
    hasInnerContainers: true,
    collapseDepth: 3,
  });
}

function adjustTocPosition() {
  const canvas = document.querySelector('.gh-canvas');
  const tocContainer = document.querySelector('.toc-container');

  if (!canvas || !tocContainer) return;

  function setLeft() {
    const mediaQuery = window.matchMedia('(min-width: 1280px)');
    if (!mediaQuery.matches) return;

    const canvasGrid = window.getComputedStyle(canvas).gridTemplateColumns;
    const [gridWide, gridMain] = canvasGrid.match(/[\d.]+px/g).slice(0, 2).map(value => parseFloat(value));

    const left = gridWide + gridMain - 250 - 20; // Calculate the left value for absolute toc-container
    tocContainer.style.left = `${left}px`;
    tocContainer.style.visibility = "visible";
  }

  window.addEventListener('load', function () {
    setLeft();
  });

  window.addEventListener('resize', function () {
    setTimeout(() => {
      setLeft();
    }, 250)
  });
}

export  {initToc, adjustTocPosition};
