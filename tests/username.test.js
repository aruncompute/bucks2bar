/**
 * @jest-environment jsdom
 *
 * Tests for username validation behavior in js/app.js
 * This file creates the minimal DOM expected by the script, then requires
 * the app module so it attaches listeners. Tests simulate user input,
 * submit and reset, and check feedback text and classes.
 */

const fs = require('fs');
const path = require('path');

// Helper to load the file contents of js/app.js and evaluate it after DOM is ready.
function loadAppScript() {
  const appPath = path.resolve(__dirname, '..', 'js', 'app.js');
  const code = fs.readFileSync(appPath, 'utf8');
  // Evaluate the script in the current global context. The file is written
  // as an IIFE; evaluating it will hook listeners to the DOM elements.
  eval(code);
}

beforeEach(() => {
  // Clear the document and recreate minimal DOM
  document.body.innerHTML = `
    <form id="username-form">
      <div>
        <input type="text" id="usernameInput" />
        <div id="usernameFeedback"></div>
      </div>
      <button id="submitBtn" type="submit">Submit</button>
      <button id="resetBtn" type="reset">Reset</button>
    </form>
  `;
});

afterEach(() => {
  // Clean up any global variables that the script might have added
  // (app.js uses IIFEs and shouldn't add to global scope, but guard just in case)
  // No explicit cleanup required otherwise.
});

test('valid username shows success feedback and enables submit', () => {
  loadAppScript();

  const input = document.getElementById('usernameInput');
  const feedback = document.getElementById('usernameFeedback');
  const submitBtn = document.getElementById('submitBtn');
  // Start from empty -> neutral state: no feedback, submit disabled
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(feedback.textContent).toBe('');
  expect(submitBtn.disabled).toBe(true);

  // Provide a valid username meeting rules: >=8 chars, has upper, lower, special
  input.value = 'Valid_user1!';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(feedback.textContent.toLowerCase()).toContain('looks good');
  expect(input.classList.contains('is-valid')).toBe(true);
  expect(submitBtn.disabled).toBe(false);
});

test('invalid username shows error feedback and disables submit', () => {
  loadAppScript();

  const input = document.getElementById('usernameInput');
  const feedback = document.getElementById('usernameFeedback');
  const submitBtn = document.getElementById('submitBtn');
  // Too short (<8)
  input.value = 'Abc123';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(feedback.textContent.toLowerCase()).toContain('minimum 8 characters');
  expect(input.classList.contains('is-invalid')).toBe(true);
  expect(submitBtn.disabled).toBe(true);

  // Missing uppercase
  input.value = 'valid_user1!';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(feedback.textContent.toLowerCase()).toContain('must contain at least one uppercase');
  expect(submitBtn.disabled).toBe(true);
});

test('reset button clears validation state and disables submit', () => {
  loadAppScript();

  const input = document.getElementById('usernameInput');
  const submitBtn = document.getElementById('submitBtn');
  const resetBtn = document.getElementById('resetBtn');

  // Make it valid first
  input.value = 'Valid_user1!';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(submitBtn.disabled).toBe(false);

  // Reset the form (call form.reset() so the reset event fires)
  const form = document.getElementById('username-form');
  form.reset();

  // The script clears validation on next tick via setTimeout(...,0)
  return new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
    expect(input.value).toBe('');
    expect(submitBtn.disabled).toBe(true);
  });
});
