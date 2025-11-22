
import { TestReport, QuestionLog, QuestionType, QuestionStatus, ErrorReason, TestType, TestSubType } from './types';
import { JEE_SYLLABUS as SYLLABUS_DATA } from './data/syllabus';
import { INITIAL_REPORTS, INITIAL_LOGS } from './data/initialData';

export const SUBJECT_CONFIG: Record<string, { name: string, color: string }> = {
    total: { name: 'Overall', color: '#818CF8' },
    physics: { name: 'Physics', color: '#34D399' },
    chemistry: { name: 'Chemistry', color: '#FBBF24' },
    maths: { name: 'Maths', color: '#F87171' },
};

export const SUBJECT_COLORS: Record<string, string> = { 
    physics: '#34D399', // Green
    chemistry: '#FBBF24', // Yellow
    maths: '#F87171' // Red
};

export const JEE_SYLLABUS = SYLLABUS_DATA;

export const MOCK_TEST_REPORTS: TestReport[] = INITIAL_REPORTS;

export const MOCK_QUESTION_LOGS: QuestionLog[] = INITIAL_LOGS;

export const TOPIC_WEIGHTAGE: Record<string, 'High' | 'Medium' | 'Low'> = {
    // Physics
    'Math in Physics': 'Low',
    'Units & Dimensions': 'Low',
    'Motion in 1D': 'Low',
    'Motion in 2D': 'Medium',
    'Laws of Motion': 'Medium',
    'Work Power Energy': 'High',
    'COM & Collisions': 'Medium',
    'Rotational Motion': 'High',
    'Gravitation': 'Medium',
    'Properties of Solids': 'Low',
    'Properties of Fluids': 'Medium',
    'Oscillations': 'Medium',
    'Waves & Sound': 'Medium',
    'Thermal Properties': 'Medium',
    'Thermodynamics': 'High',
    'KTG': 'Medium',
    'Electrostatics': 'High',
    'Capacitance': 'Medium',
    'Current Electricity': 'High',
    'Magnetic Properties': 'Low',
    'Magnetism & Current': 'High',
    'EMI': 'Medium',
    'AC Circuits': 'Medium',
    'EM Waves': 'Low',
    'Ray Optics': 'High',
    'Wave Optics': 'Medium',
    'Dual Nature': 'Medium',
    'Atomic Physics': 'Medium',
    'Nuclear Physics': 'Medium',
    'Semiconductors': 'High',
    'Experimental Physics': 'Low',

    // Chemistry - Class 11
    'Mole Concept': 'Medium',
    'Atomic Structure': 'Medium',
    'States of Matter': 'Low',
    'Thermodynamics (C)': 'High',
    'Chemical Equilibrium': 'Medium',
    'Ionic Equilibrium': 'High',
    'Redox Reactions': 'Low',
    'Periodic Table': 'Medium',
    'Chemical Bonding': 'High',
    'Hydrogen': 'Low',
    's Block': 'Low',
    'p Block (G13-14)': 'Medium',
    'GOC': 'High',
    'Hydrocarbons': 'High',

    // Chemistry - Class 12
    'Solid State': 'Low',
    'Solutions': 'Medium',
    'Electrochemistry': 'High',
    'Chemical Kinetics': 'Medium',
    'Surface Chemistry': 'Low',
    'Metallurgy': 'Low',
    'p Block (G15-18)': 'High',
    'd & f Block': 'Medium',
    'Coordination Compounds': 'High',
    'Practical Chemistry': 'Low',
    'Haloalkanes & Haloarenes': 'Medium',
    'Alcohols, Phenols & Ethers': 'High',
    'Aldehydes & Ketones': 'High',
    'Carboxylic Acids': 'Medium',
    'Amines': 'Medium',
    'Biomolecules': 'Medium',
    'Polymers': 'Low',
    'Everyday Chemistry': 'Low',
    
    // Maths - Algebra
    'Quadratic Equations': 'Medium',
    'Complex Numbers': 'Medium',
    'P&C': 'Medium',
    'Sequences & Series': 'Medium',
    'Binomial Theorem': 'Low',
    'Statistics': 'Low',
    'Matrices': 'High',
    'Determinants': 'Medium',
    'Probability': 'High',

    // Maths - Calculus
    'Limits': 'Medium',
    'Sets & Relations': 'Low',
    'Functions': 'High',
    'C&D': 'Medium',
    'Differentiation': 'Low',
    'AOD': 'High',
    'Indefinite Integration': 'Medium',
    'Definite Integration': 'High',
    'Area Under Curves': 'Medium',
    'Differential Eqns': 'High',

    // Maths - Coordinate Geometry
    'Straight Lines': 'Medium',
    'Circle': 'Medium',
    'Parabola': 'Medium',
    'Ellipse': 'Low',
    'Hyperbola': 'Low',

    // Maths - Trigonometry
    'Trigonometry': 'Low',
    'Trigonometric Functions': 'Medium',
    'ITF': 'Low',

    // Maths - Vector
    'Vector Algebra': 'High',
    '3D Geometry': 'High'
};

export const TOPIC_DEPENDENCIES: Record<string, string[]> = {
    // Physics
    'Motion in 1D': ['Math in Physics', 'Units & Dimensions'],
    'Motion in 2D': ['Motion in 1D', 'Math in Physics'], // Vectors
    'Laws of Motion': ['Motion in 1D', 'Motion in 2D'],
    'Work Power Energy': ['Laws of Motion'],
    'COM & Collisions': ['Laws of Motion', 'Work Power Energy'],
    'Rotational Motion': ['COM & Collisions', 'Circular Motion', 'Work Power Energy'],
    'Gravitation': ['Laws of Motion', 'Work Power Energy'],
    'Properties of Fluids': ['Laws of Motion'],
    'Oscillations': ['Motion in 1D', 'Laws of Motion'],
    'Waves & Sound': ['Oscillations'],
    'Electrostatics': ['Math in Physics', 'Work Power Energy'], // Vectors
    'Current Electricity': ['Electrostatics'],
    'Magnetism & Current': ['Current Electricity', 'Math in Physics'], // Vectors
    'EMI': ['Magnetism & Current'],
    'AC Circuits': ['EMI'],
    'Ray Optics': ['Math in Physics'], // Geometry
    'Wave Optics': ['Waves & Sound', 'Ray Optics'],
    'Atomic Physics': ['Dual Nature'],
    'Nuclear Physics': ['Atomic Physics'],

    // Maths
    'Functions': ['Sets & Relations'],
    'Trigonometric Functions': ['Trigonometry', 'Functions'],
    'ITF': ['Functions', 'Trigonometry', 'Trigonometric Functions'],
    'Limits': ['Functions'],
    'C&D': ['Limits'],
    'AOD': ['C&D', 'Differentiation'],
    'Indefinite Integration': ['AOD', 'Trigonometry'],
    'Definite Integration': ['Indefinite Integration'],
    'Differential Eqns': ['Definite Integration'],
    'Probability': ['P&C', 'Sets & Relations'],
    'Vector Algebra': ['Trigonometry'],
    '3D Geometry': ['Vector Algebra', 'Straight Lines'],
    'Circle': ['Straight Lines'],
    'Parabola': ['Straight Lines', 'Circle'],
    'Ellipse': ['Straight Lines', 'Circle'],
    'Hyperbola': ['Straight Lines', 'Circle'],

    // Chemistry
    'Atomic Structure': ['Mole Concept'],
    'Chemical Bonding': ['Atomic Structure', 'Periodic Table'],
    'Thermodynamics (C)': ['Mole Concept', 'States of Matter'],
    'Chemical Equilibrium': ['Thermodynamics (C)', 'Mole Concept'],
    'Ionic Equilibrium': ['Chemical Equilibrium'],
    'Redox Reactions': ['Mole Concept'],
    'Electrochemistry': ['Redox Reactions', 'Chemical Equilibrium'],
    'Chemical Kinetics': ['Chemical Equilibrium'],
    'GOC': ['Chemical Bonding'],
    'Hydrocarbons': ['GOC'],
    'Haloalkanes & Haloarenes': ['Hydrocarbons'],
    'Alcohols, Phenols & Ethers': ['Haloalkanes & Haloarenes'],
    'Aldehydes & Ketones': ['Alcohols, Phenols & Ethers'],
    'Carboxylic Acids': ['Aldehydes & Ketones'],
    'Amines': ['Haloalkanes & Haloarenes'],
    'Coordination Compounds': ['Chemical Bonding', 'd & f Block']
};