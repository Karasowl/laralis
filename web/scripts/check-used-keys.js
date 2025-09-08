const fs = require('fs');
const path = require('path');
const used = JSON.parse(fs.readFileSync(path.join(__dirname, 'used-keys.json'), 'utf8'));
function count(k){ return used.filter(x => x === k).length; }
console.log({
  treatments: count('treatments'),
  expenses: count('expenses'),
  settings: count('settings'),
});

