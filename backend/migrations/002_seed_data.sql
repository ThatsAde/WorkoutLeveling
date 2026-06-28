-- Movement Types
INSERT OR IGNORE INTO movement_types (name) VALUES
    ('Push'),
    ('Pull'),
    ('Squat'),
    ('Hinge'),
    ('Core'),
    ('Carry'),
    ('Locomotion'),
    ('Skill');

-- Workout Categories
INSERT OR IGNORE INTO workout_categories (name) VALUES
    ('Full Body'),
    ('Upper Body'),
    ('Lower Body'),
    ('Core & Stability'),
    ('Skill & Technique'),
    ('Conditioning');

-- Muscles
INSERT OR IGNORE INTO muscles (name, group_name, body_side) VALUES
    -- Push
    ('Pectoralis Major',    'Push',  'bilateral'),
    ('Pectoralis Minor',    'Push',  'bilateral'),
    ('Anterior Deltoid',    'Push',  'bilateral'),
    ('Medial Deltoid',      'Push',  'bilateral'),
    ('Triceps Brachii',     'Push',  'bilateral'),
    -- Pull
    ('Latissimus Dorsi',    'Pull',  'bilateral'),
    ('Trapezius',           'Pull',  'bilateral'),
    ('Rhomboids',           'Pull',  'bilateral'),
    ('Rear Deltoid',        'Pull',  'bilateral'),
    ('Biceps Brachii',      'Pull',  'bilateral'),
    ('Brachialis',          'Pull',  'bilateral'),
    ('Brachioradialis',     'Pull',  'bilateral'),
    ('Teres Major',         'Pull',  'bilateral'),
    ('Teres Minor',         'Pull',  'bilateral'),
    -- Core
    ('Rectus Abdominis',    'Core',  'bilateral'),
    ('Obliquus Externus',   'Core',  'bilateral'),
    ('Obliquus Internus',   'Core',  'bilateral'),
    ('Transversus Abdominis','Core', 'bilateral'),
    ('Erector Spinae',      'Core',  'bilateral'),
    ('Serratus Anterior',   'Core',  'bilateral'),
    -- Legs
    ('Quadriceps',          'Legs',  'bilateral'),
    ('Hamstrings',          'Legs',  'bilateral'),
    ('Gluteus Maximus',     'Legs',  'bilateral'),
    ('Gluteus Medius',      'Legs',  'bilateral'),
    ('Gastrocnemius',       'Legs',  'bilateral'),
    ('Soleus',              'Legs',  'bilateral'),
    ('Hip Flexors',         'Legs',  'bilateral'),
    -- Forearms
    ('Forearm Flexors',     'Forearms', 'bilateral'),
    ('Forearm Extensors',   'Forearms', 'bilateral'),
    -- Shoulders
    ('Rotator Cuff',        'Shoulders', 'bilateral');

-- Sample Exercises
INSERT OR IGNORE INTO exercises (name, movement_type_id, is_weighted, difficulty, description, is_timed) VALUES
    ('Push-up',           (SELECT id FROM movement_types WHERE name='Push'), 0, 1, 'Standard push-up with hands shoulder-width apart.', 0),
    ('Diamond Push-up',   (SELECT id FROM movement_types WHERE name='Push'), 0, 2, 'Push-up with hands close together forming a diamond.', 0),
    ('Pike Push-up',      (SELECT id FROM movement_types WHERE name='Push'), 0, 2, 'Push-up in pike position targeting shoulders.', 0),
    ('Dips',              (SELECT id FROM movement_types WHERE name='Push'), 0, 2, 'Parallel bar dips.', 0),
    ('Weighted Dips',     (SELECT id FROM movement_types WHERE name='Push'), 1, 3, 'Parallel bar dips with added weight.', 0),
    ('Handstand Push-up', (SELECT id FROM movement_types WHERE name='Push'), 0, 5, 'Full handstand push-up against wall or freestanding.', 0),
    ('Pull-up',           (SELECT id FROM movement_types WHERE name='Pull'), 0, 2, 'Standard overhand grip pull-up.', 0),
    ('Chin-up',           (SELECT id FROM movement_types WHERE name='Pull'), 0, 2, 'Underhand grip pull-up emphasizing biceps.', 0),
    ('Weighted Pull-up',  (SELECT id FROM movement_types WHERE name='Pull'), 1, 4, 'Pull-up with added weight via belt or vest.', 0),
    ('Archer Pull-up',    (SELECT id FROM movement_types WHERE name='Pull'), 0, 4, 'One-arm assisted pull-up progression.', 0),
    ('One-Arm Pull-up',   (SELECT id FROM movement_types WHERE name='Pull'), 0, 5, 'Full one-arm pull-up.', 0),
    ('Australian Row',    (SELECT id FROM movement_types WHERE name='Pull'), 0, 1, 'Horizontal pull / bodyweight row under a bar.', 0),
    ('Squat',             (SELECT id FROM movement_types WHERE name='Squat'), 0, 1, 'Bodyweight squat.', 0),
    ('Pistol Squat',      (SELECT id FROM movement_types WHERE name='Squat'), 0, 4, 'Single-leg squat.', 0),
    ('Shrimp Squat',      (SELECT id FROM movement_types WHERE name='Squat'), 0, 4, 'Single-leg squat holding rear foot.', 0),
    ('Nordic Curl',       (SELECT id FROM movement_types WHERE name='Hinge'),  0, 4, 'Eccentric hamstring exercise.', 0),
    ('Glute Bridge',      (SELECT id FROM movement_types WHERE name='Hinge'),  0, 1, 'Hip thrust from floor.', 0),
    ('L-Sit',             (SELECT id FROM movement_types WHERE name='Core'),   0, 3, 'Isometric L-sit on parallel bars or floor.', 1),
    ('Hollow Body Hold',  (SELECT id FROM movement_types WHERE name='Core'),   0, 2, 'Isometric hollow body position.', 1),
    ('Plank',             (SELECT id FROM movement_types WHERE name='Core'),   0, 1, 'Standard prone plank.', 1),
    ('Front Lever',       (SELECT id FROM movement_types WHERE name='Pull'),   0, 5, 'Horizontal hold on bar, body parallel to ground.', 1),
    ('Back Lever',        (SELECT id FROM movement_types WHERE name='Push'),   0, 5, 'Horizontal hold on bar, body parallel to ground, facing down.', 1),
    ('Planche',           (SELECT id FROM movement_types WHERE name='Push'),   0, 5, 'Horizontal hold with arms straight, body parallel to ground.', 1),
    ('Muscle-up',         (SELECT id FROM movement_types WHERE name='Pull'),   0, 4, 'Pull-up transitioning above bar into dip.', 0),
    ('Human Flag',        (SELECT id FROM movement_types WHERE name='Core'),   0, 5, 'Lateral hold on vertical pole.', 1);

-- Exercise Muscles (sample mappings)
-- Push-up (id=1)
INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_id, role) VALUES
    (1, (SELECT id FROM muscles WHERE name='Pectoralis Major'), 'primary'),
    (1, (SELECT id FROM muscles WHERE name='Triceps Brachii'), 'primary'),
    (1, (SELECT id FROM muscles WHERE name='Anterior Deltoid'), 'secondary'),
    (1, (SELECT id FROM muscles WHERE name='Serratus Anterior'), 'secondary');

-- Pull-up (id=7)
INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_id, role) VALUES
    (7, (SELECT id FROM muscles WHERE name='Latissimus Dorsi'), 'primary'),
    (7, (SELECT id FROM muscles WHERE name='Biceps Brachii'), 'primary'),
    (7, (SELECT id FROM muscles WHERE name='Trapezius'), 'secondary'),
    (7, (SELECT id FROM muscles WHERE name='Brachialis'), 'secondary'),
    (7, (SELECT id FROM muscles WHERE name='Teres Major'), 'secondary');

-- Dips (id=4)
INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_id, role) VALUES
    (4, (SELECT id FROM muscles WHERE name='Pectoralis Major'), 'primary'),
    (4, (SELECT id FROM muscles WHERE name='Triceps Brachii'), 'primary'),
    (4, (SELECT id FROM muscles WHERE name='Anterior Deltoid'), 'secondary');

-- Pistol Squat (id=14)
INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_id, role) VALUES
    (14, (SELECT id FROM muscles WHERE name='Quadriceps'), 'primary'),
    (14, (SELECT id FROM muscles WHERE name='Gluteus Maximus'), 'primary'),
    (14, (SELECT id FROM muscles WHERE name='Hamstrings'), 'secondary'),
    (14, (SELECT id FROM muscles WHERE name='Gastrocnemius'), 'secondary');

-- Exercise Tendons (sample)
INSERT OR IGNORE INTO exercise_tendons (exercise_id, tendon_name) VALUES
    (14, 'Patellar'),
    (14, 'Achilles'),
    (7,  'Bicipital'),
    (7,  'Elbow'),
    (9,  'Bicipital'),
    (9,  'Elbow');
