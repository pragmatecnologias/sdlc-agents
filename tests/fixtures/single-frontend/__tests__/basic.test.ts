import { greet, add } from '../src/index';

describe('greet', () => {
  it('should return a greeting with the provided name', () => {
    expect(greet('Alice')).toBe('Hello, Alice!');
  });

  it('should handle empty string', () => {
    expect(greet('')).toBe('Hello, !');
  });
});

describe('add', () => {
  it('should add two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('should handle negative numbers', () => {
    expect(add(-1, 1)).toBe(0);
  });

  it('should handle zero', () => {
    expect(add(0, 0)).toBe(0);
  });
});
