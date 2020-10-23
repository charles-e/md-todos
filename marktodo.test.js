const mtodo = require('./marktodo.js');

test('read three todos', () => {
  const text = 
  `- [ ] test 1
  - [ ] test 2
  - [x] test3`;
  const todos = mtodo.findAll(text, "test.md");
  expect(todos.length).toBe(3);
  });
