-- Staff roster: Fred (admin), Caren (manager), Derrick/Levis/Jeophrey/Abel (washers).
-- Login identifier is `abbreviation`; passwords are 4x the abbreviation letter
-- (Fred=F => FFFF, Caren=C => CCCC, etc.). Hashes below are bcrypt(12).
-- The admin row from the DB reset (role ADMIN) becomes Fred.

UPDATE users
SET full_name = 'Fred', abbreviation = 'F', role = 'ADMIN', is_active = true,
    hashed_password = '$2a$12$kiPPaGyrtmEU2N2zjlpKmO4cZ4OlzxwNIvkLpluZNPiasWOXvyX3q'
WHERE role = 'ADMIN';

INSERT INTO users (full_name, abbreviation, role, hashed_password, is_active, payable_balance, debt_balance)
VALUES
  ('Caren',   'C', 'MANAGER',  '$2a$12$uWaBafc28fr/IRndFfP0HuZzaaSHyN/6Rintsin0QTm/.pcZRuWK2', true, 0, 0),
  ('Derrick', 'D', 'EMPLOYEE', '$2a$12$RcHWiSVpAje1b838dSW2yeVWK/tikbNXCBysy4lIuBt5q/7gVqddy', true, 0, 0),
  ('Levis',   'L', 'EMPLOYEE', '$2a$12$nwSOwg50iZveT2SBcFahcup8twIZ4eI7lyJSVlhzEwo0y7cGjT8VS', true, 0, 0),
  ('Jeophrey','J', 'EMPLOYEE', '$2a$12$KfdLjtpLuXlAnlXgEmiPIOO6oJF7yzF99K6AKGwkfu2cYIjTmo6Ze', true, 0, 0),
  ('Abel',    'A', 'EMPLOYEE', '$2a$12$kkuI.n748as7Y8A7pCEtu.dtZdIAOii9KMhf/Mv8xrtXbd7OOTU1u', true, 0, 0);
