import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom does not lay anything out or implement modal dialogs. These stand-ins are enough for the tests.
Element.prototype.scrollIntoView = () => {};
Element.prototype.scrollTo = () => {};
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
