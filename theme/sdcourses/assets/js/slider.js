import Swiper from 'swiper';
import { Navigation, Pagination, EffectFade, Controller } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

let imgSlider;
let contentSlider;

export const initSliders = () => {
  imgSlider = new Swiper('.swiper.img-slider', {
    modules: [Navigation, Pagination, Controller],
    direction: 'horizontal',
    loop: true,
    slidesPerView: 1,
    parallax: true,
    speed: 1000,
    effect: "fade",
    allowTouchMove: true,
    watchOverflow: true,
    breakpoints: {
      1100: {
        allowTouchMove: false
      }
    },
  });

  contentSlider = new Swiper('.swiper.content-slider', {
    modules: [Navigation, Pagination, EffectFade, Controller],
    direction: 'horizontal',
    loop: true,
    slidesPerView: 1,
    spaceBetween: 24,
    parallax: true,
    speed: 1000,
    effect: "fade",
    fadeEffect: {
      crossFade: true,
    },
    allowTouchMove: true,
    watchOverflow: true,
    breakpoints: {
      1100: {
        allowTouchMove: false
      }
    },
    pagination: {
      el: '.slider-pagination',
      clickable: true,
      bulletClass: 'slider-pagination-bullet',
      bulletActiveClass: 'active',
      renderBullet: function (_, className) {
        return `<div class="${className}"><span></span></div>`;
      }
    },
    navigation: {
      prevEl: '.slider-button-prev',
      nextEl: '.slider-button-next'
    }
  });

  // Link the sliders
  imgSlider.controller.control = contentSlider;
  contentSlider.controller.control = imgSlider;
};

