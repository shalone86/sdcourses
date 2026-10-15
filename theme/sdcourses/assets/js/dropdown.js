import imagesLoaded from  "imagesloaded";
import {makeHeaderNavi} from './navigation.js';

export default function dropdown() {
    const mediaQuery = window.matchMedia('(max-width: 767px)');

    const head = document.querySelector('.gh-navigation');
    const menu = head.querySelector('.gh-navigation-menu');
    const nav = menu?.querySelector('.nav');
    if (!nav) return;

    const logo = document.querySelector('.gh-navigation-logo');
    const navHTML = nav.innerHTML;

    if (mediaQuery.matches) {
        const items = nav.querySelectorAll('li');
        items.forEach(function (item, index) {
            item.style.transitionDelay = `${0.03 * (index + 1)}s`;
        });
    }

    const makeDropdown = function () {
        if (mediaQuery.matches) return;
        const submenuItems = [];

        while ((nav.offsetWidth + 64) > menu.offsetWidth) {
            if (nav.lastElementChild) {
                submenuItems.unshift(nav.lastElementChild);
                nav.lastElementChild.remove();
            } else {
                break;
            }
        }

        if (!submenuItems.length) {
            head.classList.add('is-dropdown-loaded');
            return;
        }

        const toggle = document.createElement('button');
        toggle.setAttribute('class', 'gh-more-toggle gh-icon-button');
        toggle.setAttribute('aria-label', 'More');
        toggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor"><path d="M21.333 16c0-1.473 1.194-2.667 2.667-2.667v0c1.473 0 2.667 1.194 2.667 2.667v0c0 1.473-1.194 2.667-2.667 2.667v0c-1.473 0-2.667-1.194-2.667-2.667v0zM13.333 16c0-1.473 1.194-2.667 2.667-2.667v0c1.473 0 2.667 1.194 2.667 2.667v0c0 1.473-1.194 2.667-2.667 2.667v0c-1.473 0-2.667-1.194-2.667-2.667v0zM5.333 16c0-1.473 1.194-2.667 2.667-2.667v0c1.473 0 2.667 1.194 2.667 2.667v0c0 1.473-1.194 2.667-2.667 2.667v0c-1.473 0-2.667-1.194-2.667-2.667v0z"></path></svg>';

        const wrapper = document.createElement('div');
        wrapper.setAttribute('class', 'gh-dropdown');

        if (submenuItems.length >= 10) {
            head.classList.add('is-dropdown-mega');
            wrapper.style.gridTemplateRows = `repeat(${Math.ceil(submenuItems.length / 2)}, 1fr)`;
        } else {
            head.classList.remove('is-dropdown-mega');
        }

        submenuItems.forEach(function (child) {
            wrapper.appendChild(child);
        });

        toggle.appendChild(wrapper);
        nav.appendChild(toggle);

        const toggleRect = toggle.getBoundingClientRect();
        const documentCenter = window.innerWidth / 2;

        if (toggleRect.left < documentCenter) {
            wrapper.classList.add('is-left');
        }

        head.classList.add('is-dropdown-loaded');

        window.addEventListener('click', function (e) {
            const nestedMenuList = toggle.querySelectorAll(".menu-has-subitems");
            if (nestedMenuList) {
                // Prevent dropdown menu from collapsing when the nested menu inside is clicked
                if (head.classList.contains('is-dropdown-open')) {
                    const clickedNestedMenu = Array.from(nestedMenuList).find(menu => menu.contains(e.target));
                      if (!clickedNestedMenu || clickedNestedMenu.querySelector(".header-nested-menu").contains(e.target)) {
                          head.classList.remove('is-dropdown-open');
                      }
                } else if (toggle.contains(e.target)) {
                    head.classList.add('is-dropdown-open');
                }

            } else {
                if (head.classList.contains('is-dropdown-open')) {
                    head.classList.remove('is-dropdown-open');
                } else if (toggle.contains(e.target)) {
                    head.classList.add('is-dropdown-open');
                }
            }
        });
    }

    imagesLoaded(logo, function () {
        makeHeaderNavi();
        makeDropdown();
    });

    window.addEventListener('load', function () {
        if (!logo) {
            makeHeaderNavi();
            makeDropdown();
        }
    });

    window.addEventListener('resize', function () {
        setTimeout(() => {
            nav.innerHTML = navHTML;
            makeHeaderNavi()
            makeDropdown();
        }, 1);
    });
}
