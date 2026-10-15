function extractElements(liElement) {
  const linkElement = liElement.querySelector('a');
  const spanElement = linkElement.querySelector('span');
  return {link: linkElement, span: spanElement, label: spanElement.textContent};
}

function makeHeaderNavi() {
  const headerMenu = document.querySelector('.gh-navigation-menu');
  if (!headerMenu) return;

  const subItem = headerMenu.querySelector('.is-subitem');
  if (!subItem) return;

  function createNav(liElementArray) {
    const ulElement = document.createElement('ul');
    ulElement.classList.add('header-nested-menu');

    liElementArray.forEach(liElement => {
      ulElement.appendChild(liElement);
    })

    return ulElement;
  }

  const menuItems = headerMenu.querySelectorAll("ul li");

  const menuItemMap = new Map(); // parent menu item => [child menu item]

  let currentItem = null;
  let subMenuItems = [];
  menuItems.forEach((item, index) => {
    if (!item.classList.contains('is-subitem')) {
      if (currentItem !== null) {
        menuItemMap.set(currentItem, subMenuItems);
      }

      currentItem = item;
      subMenuItems = [];
    } else {
      const {span, label} = extractElements(item);
      span.textContent = label.slice(1);

      subMenuItems.push(item);
    }
  });
  if (currentItem !== null) {
    menuItemMap.set(currentItem, subMenuItems);
  }

  menuItemMap.forEach((subItems, item) => {
    if (subItems.length === 0) {
      return;
    }

    item.innerHTML = item.innerHTML.replace(/href="[^"]*"/, 'href="#"');

    const {link} = extractElements(item);

    link.innerHTML += `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <polyline points="6 9 12 15 18 9"></polyline>
</svg>
`;

    item.appendChild(createNav(subItems));
    item.classList.add("menu-has-subitems");

    window.addEventListener('click', function (e) {
      if (item.classList.contains('is-nested-open')) {
        item.classList.remove('is-nested-open');
      } else if (item.contains(e.target)) {
        item.classList.add('is-nested-open');
      }
    });
  });
}

function makeFooterNavi() {
  const footerNav = document.querySelector('.footer-nav');
  const footerMenu = document.querySelector('.gh-footer-menu');
  if (!footerMenu || !footerNav) return;

  const subItem = footerMenu.querySelector('.is-subitem');
  if (!subItem) return;

  function createNav(label, liElementArray) {
    const divElement = document.createElement('div');
    divElement.classList.add('footer-nested-menu');

    const spanElement = document.createElement('span');
    spanElement.textContent = label;

    const navElement = document.createElement('nav');

    const ulElement = document.createElement('ul');
    ulElement.classList.add('nav', 'secondary', 'submenu');

    liElementArray.forEach(liElement => {
      ulElement.appendChild(liElement);
    })

    navElement.appendChild(ulElement);
    divElement.appendChild(spanElement);
    divElement.appendChild(navElement);
    return divElement;
  }

  function createSpanPlaceholder() {
    let spanElement = document.createElement('span');
    spanElement.classList.add('span-placeholder');
    return spanElement;
  }

  function getMenuItemMap(menuItems, menuItemMap) {
    let currentItemLabel = null;
    let subMenuItems = [];
    menuItems.forEach((item, index) => {
      if (!item.classList.contains('is-subitem')) {
        if (currentItemLabel !== null) {
          menuItemMap.set(currentItemLabel, subMenuItems);
        }

        currentItemLabel = extractElements(item).label;
        subMenuItems = [];
      } else {
        const {span, label} = extractElements(item);
        span.textContent = label.slice(1);

        subMenuItems.push(item);
      }
    });
    if (currentItemLabel !== null) {
      menuItemMap.set(currentItemLabel, subMenuItems);
    }
  }

  const menuItems = footerMenu.querySelectorAll("ul li");

  const menuItemMap = new Map(); // parent menu item => [child menu item]
  getMenuItemMap(menuItems, menuItemMap);

  footerMenu.remove();

  // To make the footer nav menu align right side of container
  const lgQuery = window.matchMedia('(max-width: 1199px)');
  const smQuery = window.matchMedia('(max-width: 767px)');

  if (!lgQuery.matches && !smQuery.matches) {
    // max-width >= 1200, 6 column grid
    if (menuItemMap.size < 4) {
      Array.from({length: 4 - menuItemMap.size}).forEach(() => footerNav.append(createSpanPlaceholder()));
    }

  } else if (lgQuery.matches && !smQuery.matches) {
    // max-width < 1200, 5 column grid
    if (menuItemMap.size < 3) {
      Array.from({length: 3 - menuItemMap.size}).forEach(() => footerNav.append(createSpanPlaceholder()));
    }
  }

  menuItemMap.forEach((subItems, label) => {
    footerNav.append(createNav(label, subItems));
  });
}

export {makeHeaderNavi, makeFooterNavi};
