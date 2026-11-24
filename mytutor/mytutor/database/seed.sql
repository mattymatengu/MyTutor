-- Sample data: modules only. Users are created by server/db.js (passwords must be hashed).
INSERT OR IGNORE INTO modules (code, name, department, level, description) VALUES
 ('PRG521S', 'Programming 1',               'Computer Science',    1, 'Introduction to programming: variables, control flow, functions and arrays.'),
 ('DSA612S', 'Distributed Systems',          'Software Development',2, 'Microservices, messaging, containers and fault tolerance.'),
 ('WAD621S', 'Web Application Development',  'Software Development',2, 'HTML, CSS, JavaScript, server-side programming and databases.'),
 ('DBS521S', 'Database Systems',             'Computer Science',    1, 'Relational model, SQL, normalisation and ER modelling.'),
 ('MAT511S', 'Mathematics 1',                'Mathematics',         1, 'Functions, limits, differentiation and an introduction to integration.'),
 ('ACC511S', 'Financial Accounting 1',       'Accounting',          1, 'Double-entry bookkeeping, trial balance and basic financial statements.'),
 ('NET611S', 'Computer Networks',            'Computer Science',    2, 'OSI/TCP-IP models, addressing, routing and switching.'),
 ('STA511S', 'Statistics 1',                 'Mathematics',         1, 'Descriptive statistics, probability and distributions.');
