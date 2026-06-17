const fs = require('fs');
const content = fs.readFileSync('./src/app/page.tsx', 'utf8');

const parts = content.split('      <div style={{ display: \'grid\', gridTemplateColumns: \'1fr\', gap: \'1.5rem\' }}>');
const topPart = parts[0];
const bottomPart = parts[1];

const importantTasksMatch = bottomPart.match(/        \{\/\* Important Tasks \*\/\}([\s\S]*?)        \{\/\* Team Performance \*\/\}/);
const teamPerfMatch = bottomPart.match(/        \{\/\* Team Performance \*\/\}([\s\S]*?)        \{\/\* Company Work Summary \*\/\}/);
const companySummaryMatch = bottomPart.match(/        \{\/\* Company Work Summary \*\/\}([\s\S]*?)      <\/div>\r?\n    <\/div>\r?\n  \);\r?\n\}/);

if (importantTasksMatch && teamPerfMatch && companySummaryMatch) {
  const importantTasks = '        {/* Important Tasks */}' + importantTasksMatch[1];
  const teamPerf = '        {/* Team Performance */}' + teamPerfMatch[1].replace(/boxShadow: '0 4px 15px rgba\\(0,0,0,0.02\\)' \}\}/, "boxShadow: '0 4px 15px rgba(0,0,0,0.02)', height: '100%' }}");
  const companySummary = '        {/* Company Work Summary */}' + companySummaryMatch[1].replace(/boxShadow: '0 4px 15px rgba\\(0,0,0,0.02\\)' \}\}/, "boxShadow: '0 4px 15px rgba(0,0,0,0.02)', height: '100%' }}");

  const newContent = topPart + 
    '      <div style={{ display: \'grid\', gridTemplateColumns: \'repeat(auto-fit, minmax(380px, 1fr))\', gap: \'1.5rem\', marginBottom: \'1.5rem\' }}>\n' +
    teamPerf +
    companySummary +
    '      </div>\n\n' +
    '      <div style={{ display: \'grid\', gridTemplateColumns: \'1fr\', gap: \'1.5rem\' }}>\n' +
    importantTasks +
    '      </div>\n' +
    '    </div>\n' +
    '  );\n' +
    '}\n';
    
  fs.writeFileSync('./src/app/page.tsx', newContent);
  console.log('Rearranged layout successfully');
} else {
  console.log('Failed to match sections');
}
