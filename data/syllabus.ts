
export const JEE_SYLLABUS = {
    physics: [
        {
            unit: "Mechanics 1",
            chapters: [
                { name: "Math in Physics", subTopics: ["Vectors", "Calculus for Physics", "Integration", "Differentiation", "Maxima & Minima", "Graphs", "Trigonometry for Physics", "Logarithms"] },
                { name: "Units & Dimensions", subTopics: ["Units (SI & CGS)", "Dimensional Analysis", "Applications of Dimensions", "Errors (Random & Systematic)", "Significant Figures", "Vernier Calipers", "Screw Gauge", "Spherometer"] },
                { name: "Motion in 1D", subTopics: ["Distance & Displacement", "Average Speed & Velocity", "Instantaneous Velocity", "Uniform Acceleration", "Equations of Motion", "Motion under Gravity", "Graphs (x-t, v-t, a-t)", "Relative Motion in 1D", "Variable Acceleration"] },
                { name: "Motion in 2D", subTopics: ["Projectile Motion (Ground-to-Ground)", "Projectile on Inclined Plane", "Equation of Trajectory", "Range & Max Height", "Relative Motion in 2D", "River-Boat Problems", "Rain-Man Problems", "Uniform Circular Motion (Kinematics)", "Radial & Tangential Acceleration"] },
                { name: "Laws of Motion", subTopics: ["Newton's First Law (Inertia)", "Newton's Second Law (F=ma)", "Newton's Third Law", "Free Body Diagrams (FBD)", "Equilibrium Problems", "Tension in Strings", "Spring Force", "Friction (Static & Kinetic)", "Angle of Repose & Friction", "Banking of Roads", "Centripetal Force", "Pseudo Force", "Constraint Motion"] },
                { name: "Work Power Energy", subTopics: ["Work Done by Constant Force", "Work Done by Variable Force", "Work-Energy Theorem", "Conservative vs Non-Conservative Forces", "Potential Energy (Gravitational & Spring)", "Conservation of Mechanical Energy", "Power", "Vertical Circular Motion", "Equilibrium & Stability"] }
            ]
        },
        {
            unit: "Mechanics 2",
            chapters: [
                { name: "COM & Collisions", subTopics: ["Center of Mass (Discrete System)", "COM of Continuous Bodies", "Motion of COM", "Linear Momentum Conservation", "Impulse", "Collision Types (Elastic, Inelastic)", "Coefficient of Restitution", "Oblique Collisions", "Variable Mass System (Rocket)"] },
                { name: "Rotational Motion", subTopics: ["Moment of Inertia", "Parallel & Perpendicular Axis Theorems", "Torque", "Rotational Equilibrium", "Angular Momentum", "Conservation of Angular Momentum", "Kinetic Energy of Rotation", "Rolling Motion (Pure Rolling)", "Rolling on Inclined Plane", "Toppling", "Combined Rotation & Translation"] },
                { name: "Gravitation", subTopics: ["Newton's Law of Gravitation", "Acceleration due to Gravity (g)", "Variation of g (Height, Depth, Rotation)", "Gravitational Field", "Gravitational Potential & Energy", "Kepler's Laws", "Escape Velocity", "Orbital Velocity", "Geostationary Satellites", "Binary Star Systems"] },
                { name: "Properties of Solids", subTopics: ["Elasticity & Plasticity", "Stress & Strain", "Hooke's Law", "Young's Modulus", "Bulk & Shear Modulus", "Poisson's Ratio", "Stress-Strain Curve", "Elastic Potential Energy", "Thermal Stress"] },
                { name: "Properties of Fluids", subTopics: ["Fluid Pressure & Pascal's Law", "Archimedes Principle & Buoyancy", "Fluid Dynamics (Ideal Fluid)", "Equation of Continuity", "Bernoulli's Theorem", "Venturimeter & Torricelli's Law", "Viscosity & Stokes Law", "Terminal Velocity", "Reynolds Number", "Surface Tension", "Capillarity & Contact Angle", "Excess Pressure"] }
            ]
        },
        {
            unit: "Oscillations & Waves",
            chapters: [
                { name: "Oscillations", subTopics: ["SHM Equation & Characteristics", "Phasor Diagram", "Energy in SHM", "Simple Pendulum", "Spring-Mass System", "Combination of Springs", "Superposition of SHMs", "Damped Oscillations", "Forced Oscillations & Resonance"] },
                { name: "Waves & Sound", subTopics: ["Types of Waves", "Wave Equation", "Speed of Transverse Wave on String", "Speed of Sound (Newton & Laplace)", "Power & Intensity", "Superposition & Interference", "Standing Waves", "String Instruments", "Organ Pipes (Open & Closed)", "Beats", "Doppler Effect"] }
            ]
        },
        {
            unit: "Thermodynamics",
            chapters: [
                { name: "Thermal Properties", subTopics: ["Temperature Scales", "Thermal Expansion (Linear, Area, Volume)", "Calorimetry (Specific Heat, Latent Heat)", "Heat Transfer: Conduction", "Convection", "Radiation (Stefan's Law, Wien's Law, Newton's Law of Cooling)"] },
                { name: "Thermodynamics", subTopics: ["Zeroth Law", "First Law of Thermodynamics", "Work Done in Processes", "Isobaric, Isochoric, Isothermal, Adiabatic Processes", "Polytropic Process", "Cyclic Processes & Graphs", "Second Law (Entropy)", "Heat Engines & Efficiency", "Carnot Cycle", "Refrigerators"] },
                { name: "KTG", subTopics: ["Ideal Gas Equation", "Kinetic Theory Postulates", "Pressure of Gas", "RMS, Average & Most Probable Speed", "Degrees of Freedom", "Law of Equipartition of Energy", "Specific Heat Capacities (Cp, Cv, Gamma)", "Mean Free Path"] }
            ]
        },
        {
            unit: "Electromagnetism 1",
            chapters: [
                { name: "Electrostatics", subTopics: ["Charge Properties", "Coulomb's Law", "Electric Field", "Electric Field Lines", "Electric Potential", "Potential Energy of System", "Electric Dipole (Field & Potential)", "Dipole in External Field", "Flux & Gauss's Law", "Applications of Gauss's Law", "Conductors & Properties", "Electrostatic Pressure"] },
                { name: "Capacitance", subTopics: ["Capacitance & Spherical Capacitor", "Parallel Plate Capacitor", "Dielectrics & Polarization", "Capacitors in Series & Parallel", "Energy Stored & Energy Density", "Common Potential & Loss of Energy", "RC Circuits (Charging & Discharging)", "Van de Graaff Generator"] }
            ]
        },
        {
            unit: "Electromagnetism 2",
            chapters: [
                { name: "Current Electricity", subTopics: ["Electric Current & Drift Velocity", "Ohm's Law & Resistance", "Color Coding", "Resistivity & Temperature Dependence", "Combination of Resistors", "Kirchhoff's Laws (KCL, KVL)", "Cells (EMF, Internal Resistance)", "Cells in Series/Parallel", "Electrical Instruments (Galvanometer, Ammeter, Voltmeter)", "Wheatstone Bridge & Meter Bridge", "Potentiometer", "Heating Effect of Current"] },
                { name: "Magnetic Properties", subTopics: ["Bar Magnet & Field Lines", "Earth's Magnetism", "Magnetic Elements", "Tangent Galvanometer", "Magnetic Materials (Dia, Para, Ferro)", "Hysteresis Loop", "Permanent Magnets & Electromagnets"] },
                { name: "Magnetism & Current", subTopics: ["Biot-Savart Law", "Ampere's Circuital Law", "Magnetic Field due to Wire, Loop, Solenoid, Toroid", "Force on Charge (Lorentz Force)", "Motion in Magnetic Field (Cyclotron)", "Force on Current Carrying Conductor", "Force between Parallel Wires", "Torque on Current Loop", "Moving Coil Galvanometer"] },
                { name: "EMI", subTopics: ["Magnetic Flux", "Faraday's Laws of Induction", "Lenz's Law", "Motional EMF", "Induced Electric Field", "Self Inductance", "Mutual Inductance", "Growth & Decay of Current in LR Circuit", "Energy in Inductor", "Eddy Currents"] },
                { name: "AC Circuits", subTopics: ["AC Voltage & Current", "RMS & Average Values", "Phasor Diagrams", "Pure R, L, C Circuits", "Series LCR Circuit (Impedance, Resonance)", "Power in AC & Power Factor", "Wattless Current", "Choke Coil", "Transformers", "LC Oscillations"] },
                { name: "EM Waves", subTopics: ["Displacement Current", "Maxwell's Equations", "Properties of EM Waves", "Energy Density & Intensity", "Electromagnetic Spectrum", "Momentum & Radiation Pressure"] }
            ]
        },
        {
            unit: "Optics",
            chapters: [
                { name: "Ray Optics", subTopics: ["Reflection (Plane & Spherical Mirrors)", "Mirror Formula & Magnification", "Refraction (Snell's Law, Glass Slab)", "Total Internal Reflection (TIR)", "Refraction at Spherical Surfaces", "Lens Maker's Formula", "Thin Lens Formula", "Combination of Lenses", "Power of Lens", "Prism (Dispersion, Deviation)", "Optical Instruments (Eye, Microscope, Telescope)"] },
                { name: "Wave Optics", subTopics: ["Wavefronts (Huygens Principle)", "Interference of Light", "Young's Double Slit Experiment (YDSE)", "Fringe Width & Intensity", "Diffraction (Single Slit)", "Resolving Power", "Polarization (Brewster's Law, Malus Law)"] }
            ]
        },
        {
            unit: "Modern Physics",
            chapters: [
                { name: "Dual Nature", subTopics: ["Electron Emission", "Photoelectric Effect", "Einstein's Photoelectric Equation", "Photon Properties", "Matter Waves (De Broglie Wavelength)", "Davisson-Germer Experiment"] },
                { name: "Atomic Physics", subTopics: ["Alpha Particle Scattering", "Rutherford Model", "Bohr Model (Postulates, Radius, Velocity, Energy)", "Hydrogen Spectrum Series", "Ionization & Excitation Energy", "X-Rays (Continuous & Characteristic, Moseley's Law)"] },
                { name: "Nuclear Physics", subTopics: ["Nucleus Properties (Size, Density)", "Mass Defect & Binding Energy", "Radioactivity (Alpha, Beta, Gamma Decay)", "Law of Radioactive Decay", "Half Life & Mean Life", "Nuclear Fission & Fusion", "Nuclear Reactor"] },
                { name: "Semiconductors", subTopics: ["Energy Bands", "Intrinsic & Extrinsic Semiconductors", "PN Junction Diode", "Biasing (Forward & Reverse)", "Rectifiers (Half & Full Wave)", "Zener Diode", "Optoelectronic Devices (LED, Photodiode, Solar Cell)", "Logic Gates (OR, AND, NOT, NAND, NOR)", "Transistors (BJT - Basics)"] }
            ]
        },
        {
            unit: "Experimental",
            chapters: [
                { name: "Experimental Physics", subTopics: ["Vernier Calipers & Screw Gauge", "Simple Pendulum (g measurement)", "Young's Modulus (Searle's Method)", "Surface Tension (Capillary Rise)", "Viscosity (Terminal Velocity)", "Speed of Sound (Resonance Tube)", "Specific Heat (Cooling Method)", "Focal Length of Mirrors/Lenses", "Meter Bridge & Ohm's Law", "Potentiometer", "Pn Junction Characteristics", "Zener Diode Characteristics"] }
            ]
        }
    ],
    chemistry: [
        {
            unit: "Class 11 - Physical",
            chapters: [
                { name: "Mole Concept", subTopics: ["Basic Units & Atomic Mass", "Mole Definition", "Molar Mass", "Empirical & Molecular Formula", "Stoichiometry & Balancing", "Limiting Reagent", "Concentration Terms (Molarity, Molality, Normality, Mole Fraction)", "Equivalent Weight", "Redox Titrations (n-factor)"] },
                { name: "Atomic Structure", subTopics: ["Subatomic Particles", "Rutherford & Bohr Models", "Hydrogen Spectrum", "Dual Nature of Matter (De Broglie)", "Heisenberg Uncertainty Principle", "Quantum Mechanical Model", "Quantum Numbers", "Electronic Configuration (Aufbau, Pauli, Hund)", "Shapes of Orbitals"] },
                { name: "States of Matter", subTopics: ["Intermolecular Forces", "Gas Laws (Boyle, Charles, Avogadro)", "Ideal Gas Equation", "Dalton's Law of Partial Pressure", "Graham's Law of Diffusion", "Kinetic Theory of Gases", "Real Gases & Compressibility Factor (Z)", "Van der Waals Equation", "Liquefaction of Gases", "Liquid State Properties"] },
                { name: "Thermodynamics (C)", subTopics: ["System & Surroundings", "State Functions", "First Law of Thermodynamics", "Internal Energy & Enthalpy", "Heat Capacity (Cp, Cv)", "Work Done in Processes", "Hess's Law", "Enthalpy of Formation/Combustion/Bond Dissociation", "Second Law (Entropy)", "Gibbs Free Energy & Spontaneity"] },
                { name: "Chemical Equilibrium", subTopics: ["Law of Mass Action", "Equilibrium Constants (Kp & Kc)", "Reaction Quotient (Q)", "Le Chatelier's Principle", "Factors Affecting Equilibrium", "Degree of Dissociation", "Homogeneous & Heterogeneous Equilibria"] },
                { name: "Ionic Equilibrium", subTopics: ["Arrhenius, Bronsted-Lowry, Lewis Acids/Bases", "Ionization of Water (Kw)", "pH Scale", "Ionization of Weak Acids/Bases", "Salt Hydrolysis", "Buffer Solutions (Henderson Equation)", "Solubility Product (Ksp)", "Common Ion Effect"] },
                { name: "Redox Reactions", subTopics: ["Oxidation Number Concept", "Oxidation & Reduction", "Types of Redox Reactions", "Balancing Redox Reactions", "Disproportionation Reactions", "Electrochemical Series Basics"] }
            ]
        },
        {
            unit: "Class 11 - Inorganic",
            chapters: [
                { name: "Periodic Table", subTopics: ["History of Periodic Table", "Modern Periodic Law", "Electronic Configuration", "Atomic & Ionic Radii", "Ionization Enthalpy", "Electron Gain Enthalpy", "Electronegativity", "Periodicity in Valence", "Anomalous Properties"] },
                { name: "Chemical Bonding", subTopics: ["Ionic Bond (Lattice Energy)", "Covalent Bond (Lewis Structures)", "Formal Charge", "VSEPR Theory", "Valence Bond Theory", "Hybridization", "Molecular Orbital Theory (MOT)", "Bond Order", "Hydrogen Bonding", "Dipole Moment", "Fajan's Rule"] },
                { name: "Hydrogen", subTopics: ["Position in Periodic Table", "Isotopes", "Preparation & Properties of Dihydrogen", "Hydrides", "Water & Heavy Water", "Hydrogen Peroxide", "Hydrogen as Fuel"] },
                { name: "s Block", subTopics: ["Group 1 (Alkali Metals): Properties", "Compounds of Sodium", "Anomalous Behavior of Lithium", "Group 2 (Alkaline Earth Metals): Properties", "Compounds of Calcium", "Anomalous Behavior of Beryllium", "Biological Importance of Na, K, Mg, Ca"] },
                { name: "p Block (G13-14)", subTopics: ["Group 13: Trends", "Boron Anomalous Behavior", "Borax, Boric Acid, Diborane", "Aluminum Properties", "Group 14: Trends", "Carbon Allotropes", "Carbon Monoxide/Dioxide", "Silicones, Silicates, Zeolites"] }
            ]
        },
        {
            unit: "Class 11 - Organic",
            chapters: [
                { name: "GOC", subTopics: ["IUPAC Nomenclature", "Structural Isomerism", "Stereoisomerism (Geometrical, Optical)", "Reaction Intermediates (Carbocation, Carbanion, Free Radical)", "Inductive Effect", "Resonance & Mesomeric Effect", "Hyperconjugation", "Electromeric Effect", "Types of Organic Reactions", "Purification of Organic Compounds"] },
                { name: "Hydrocarbons", subTopics: ["Alkanes: Preparation (Wurtz, Kolbe)", "Reactions (Halogenation)", "Conformations of Ethane", "Alkenes: Preparation", "Reactions (Markovnikov, Ozonolysis)", "Alkynes: Preparation & Acidic Nature", "Aromatic Hydrocarbons: Benzene Structure", "Electrophilic Substitution (Nitration, Halogenation, Friedel-Crafts)", "Huckel's Rule (Aromaticity)"] }
            ]
        },
        {
            unit: "Class 12 - Physical",
            chapters: [
                { name: "Solid State", subTopics: ["Amorphous vs Crystalline", "Unit Cells & Crystal Lattices", "Packing Efficiency (SCC, BCC, FCC)", "Density Calculations", "Imperfections in Solids (Defects)", "Electrical & Magnetic Properties", "Bragg's Law"] },
                { name: "Solutions", subTopics: ["Types of Solutions", "Solubility", "Henry's Law", "Raoult's Law", "Ideal & Non-Ideal Solutions", "Azeotropes", "Colligative Properties (VP Lowering, BP Elevation, FP Depression, Osmotic Pressure)", "Van't Hoff Factor (Abnormal Molar Mass)"] },
                { name: "Electrochemistry", subTopics: ["Electrochemical Cells", "Nernst Equation", "Standard Electrode Potential", "Gibbs Energy & EMF", "Conductance in Solutions (Kohlrausch Law)", "Electrolysis & Faraday's Laws", "Batteries (Primary, Secondary, Fuel Cells)", "Corrosion"] },
                { name: "Chemical Kinetics", subTopics: ["Rate of Reaction", "Rate Law & Order", "Integrated Rate Equations (Zero & First Order)", "Half-Life", "Pseudo First Order", "Collision Theory", "Arrhenius Equation (Activation Energy)", "Catalysis"] },
                { name: "Surface Chemistry", subTopics: ["Adsorption (Physisorption vs Chemisorption)", "Isotherms (Freundlich, Langmuir)", "Catalysis (Homogeneous, Heterogeneous, Enzyme)", "Colloids (Classification, Preparation, Properties)", "Emulsions", "Tyndall Effect", "Brownian Motion", "Coagulation (Hardy-Schulze Rule)"] }
            ]
        },
        {
            unit: "Class 12 - Inorganic",
            chapters: [
                { name: "Metallurgy", subTopics: ["Minerals & Ores", "Concentration of Ores", "Calcination & Roasting", "Reduction (Smelting)", "Thermodynamic Principles (Ellingham Diagram)", "Refining Methods (Zone Refining, etc.)", "Extraction of Al, Cu, Zn, Fe"] },
                { name: "p Block (G15-18)", subTopics: ["Group 15 (Nitrogen Family): Trends, NH3, HNO3, Phosphorus Allotropes, Phosphine", "Group 16 (Oxygen Family): Trends, O3, SO2, H2SO4 (Contact Process)", "Group 17 (Halogens): Trends, Interhalogen Compounds, Oxoacids", "Group 18 (Noble Gases): Trends, Xenon Compounds"] },
                { name: "d & f Block", subTopics: ["Transition Elements (d-block): Properties", "Oxidation States", "Colors, Magnetic Properties", "K2Cr2O7 & KMnO4 Preparation/Properties", "Inner Transition Elements (f-block): Lanthanoids (Contraction)", "Actinoids"] },
                { name: "Coordination Compounds", subTopics: ["Werner's Theory", "Ligands & Denticity", "IUPAC Nomenclature", "Isomerism in Coordination Compounds", "Valence Bond Theory (VBT)", "Crystal Field Theory (CFT)", "Color & Magnetic Properties", "Metal Carbonyls", "Stability of Complexes"] },
                { name: "Practical Chemistry", subTopics: ["Qualitative Analysis of Cations (Groups 0-6)", "Qualitative Analysis of Anions", "Flame Test", "Volumetric Analysis (Titrations)", "Organic Functional Group Tests"] }
            ]
        },
        {
            unit: "Class 12 - Organic",
            chapters: [
                { name: "Haloalkanes & Haloarenes", subTopics: ["Preparation Methods", "SN1 vs SN2 Mechanisms", "E1 vs E2 Mechanisms", "Optical Activity & Chirality", "Reactions of Haloarenes", "Polyhalogen Compounds"] },
                { name: "Alcohols, Phenols & Ethers", subTopics: ["Preparation of Alcohols/Phenols", "Acidity of Phenols", "Reactions (Esterification, Oxidation)", "Preparation of Ethers (Williamson Synthesis)", "Chemical Properties of Ethers", "Important Name Reactions (Reimer-Tiemann, Kolbe)"] },
                { name: "Aldehydes & Ketones", subTopics: ["Preparation Methods", "Nucleophilic Addition Mechanism", "Reactivity Order", "Aldol Condensation", "Cannizzaro Reaction", "Oxidation (Tollens, Fehling)", "Reduction (Clemmensen, Wolff-Kishner)"] },
                { name: "Carboxylic Acids", subTopics: ["Preparation Methods", "Acidity Trends", "Reactions (HVZ, Decarboxylation)", "Derivatives (Esters, Anhydrides, Amides, Acid Chlorides)"] },
                { name: "Amines", subTopics: ["Classification & Nomenclature", "Preparation", "Basicity Trends", "Chemical Reactions", "Diazonium Salts & Coupling Reactions", "Hinsberg Test"] },
                { name: "Biomolecules", subTopics: ["Carbohydrates (Glucose, Fructose, Starch, Cellulose)", "Amino Acids & Proteins (Structure)", "Enzymes", "Vitamins", "Nucleic Acids (DNA/RNA Structure)"] },
                { name: "Polymers", subTopics: ["Classification", "Addition Polymerization", "Condensation Polymerization", "Copolymerization", "Rubber (Natural & Synthetic)", "Biodegradable Polymers", "Commercially Important Polymers"] },
                { name: "Everyday Chemistry", subTopics: ["Drugs & Classification", "Therapeutic Action (Antacids, Analgesics, Antibiotics, etc.)", "Chemicals in Food (Preservatives, Sweeteners)", "Soaps & Detergents (Cleansing Action)"] }
            ]
        }
    ],
    maths: [
        {
            unit: "Algebra",
            chapters: [
                { name: "Quadratic Equations", subTopics: ["Roots & Coefficients", "Nature of Roots", "Formation of Equation", "Common Roots", "Graph of Quadratic Expression", "Location of Roots", "Range of Quadratic Functions", "Equations Reducible to Quadratic"] },
                { name: "Complex Numbers", subTopics: ["Algebra of Complex Numbers", "Conjugate & Modulus", "Argand Plane & Polar Form", "Euler's Form", "De Moivre's Theorem", "Cube Roots of Unity", "Geometry of Complex Numbers", "Rotation Theorem"] },
                { name: "P&C", subTopics: ["Fundamental Principles of Counting", "Permutations (Linear & Circular)", "Combinations", "Arrangements with Repetition", "Grouping & Distribution", "Derangements", "Multinomial Theorem (Number of Solutions)", "Rank of a Word"] },
                { name: "Sequences & Series", subTopics: ["AP, GP, HP", "AM, GM, HM & Inequalities", "Arithmetico-Geometric Series", "Sum of Special Series (Sigma Notation)", "Method of Differences", "Telescopic Series"] },
                { name: "Binomial Theorem", subTopics: ["Binomial Expansion", "General Term", "Middle Term", "Properties of Binomial Coefficients", "Summation of Series", "Binomial Theorem for Any Index", "Applications (Remainder, Divisibility)"] },
                { name: "Statistics", subTopics: ["Mean, Median, Mode", "Measures of Dispersion (Range, Mean Deviation)", "Variance & Standard Deviation", "Coefficient of Variation"] },
                { name: "Matrices", subTopics: ["Types of Matrices", "Algebra of Matrices", "Transpose & Conjugate", "Symmetric & Skew-Symmetric", "Determinant of a Matrix", "Adjoint & Inverse", "Rank of Matrix", "Solving System of Linear Equations (Matrix Method)"] },
                { name: "Determinants", subTopics: ["Properties of Determinants", "Minors & Cofactors", "Expansion", "Area of Triangle", "System of Linear Equations (Cramer's Rule)", "Consistency of Equations"] },
                { name: "Probability", subTopics: ["Classical Probability", "Addition Theorem", "Conditional Probability", "Independent Events", "Multiplication Theorem", "Total Probability Theorem", "Bayes' Theorem", "Bernoulli Trials & Binomial Distribution"] }
            ]
        },
        {
            unit: "Calculus",
            chapters: [
                { name: "Limits", subTopics: ["Algebra of Limits", "Standard Limits", "Indeterminate Forms", "L'Hospital's Rule", "Sandwich Theorem", "Limits using Expansion", "Limits at Infinity"] },
                { name: "Sets & Relations", subTopics: ["Set Theory Operations", "Venn Diagrams", "Cartesian Product", "Relations (Reflexive, Symmetric, Transitive)", "Equivalence Relations", "Functions as Relations"] },
                { name: "Functions", subTopics: ["Domain & Range", "Types (One-One, Many-One, Onto, Into)", "Composite Functions", "Inverse Functions", "Odd/Even & Periodic Functions", "Modulus, GIF, Fractional Part Functions"] },
                { name: "C&D", subTopics: ["Continuity at a Point & Interval", "Types of Discontinuity", "Differentiability", "Relationship between Continuity & Differentiability", "Functional Equations"] },
                { name: "Differentiation", subTopics: ["Chain Rule", "Implicit Differentiation", "Parametric Differentiation", "Logarithmic Differentiation", "Differentiation of Inverse Functions", "Higher Order Derivatives"] },
                { name: "AOD", subTopics: ["Rate of Change", "Tangents & Normals", "Approximations", "Increasing & Decreasing Functions", "Maxima & Minima (First & Second Derivative Tests)", "Global Max/Min", "Rolle's & LMVT"] },
                { name: "Indefinite Integration", subTopics: ["Standard Formulas", "Substitution Method", "Integration by Parts", "Partial Fractions", "Special Integrals", "Integration of Trigonometric Functions"] },
                { name: "Definite Integration", subTopics: ["Fundamental Theorem of Calculus", "Properties of Definite Integrals", "Integration as Limit of Sum", "Estimation of Integrals", "Wallis Formula", "Newton-Leibniz Formula"] },
                { name: "Area Under Curves", subTopics: ["Area bounded by Curve & Axis", "Area between Two Curves", "Curve Tracing Basics"] },
                { name: "Differential Eqns", subTopics: ["Order & Degree", "Formation of DE", "Variable Separable", "Homogeneous DE", "Linear DE", "Exact Differential Equations", "Bernoulli's Equation"] }
            ]
        },
        {
            unit: "Coordinate Geometry",
            chapters: [
                { name: "Straight Lines", subTopics: ["Distance Formula", "Section Formula", "Slope & Angle between Lines", "Forms of Line Equation", "Distance of Point from Line", "Family of Lines", "Pair of Straight Lines", "Locus"] },
                { name: "Circle", subTopics: ["Standard & General Equations", "Circle through Points", "Parametric Form", "Tangents & Normals", "Chord of Contact", "Director Circle", "Family of Circles", "Common Tangents"] },
                { name: "Parabola", subTopics: ["Standard Equations", "Parametric Coordinates", "Focal Chord", "Tangents & Normals", "Director Circle", "Properties of Parabola"] },
                { name: "Ellipse", subTopics: ["Standard Equation", "Foci, Directrix, Eccentricity", "Parametric Form", "Tangents & Normals", "Auxiliary Circle", "Director Circle"] },
                { name: "Hyperbola", subTopics: ["Standard Equation", "Conjugate Hyperbola", "Asymptotes", "Rectangular Hyperbola", "Tangents & Normals", "Parametric Form"] }
            ]
        },
        {
            unit: "Trigonometry",
            chapters: [
                { name: "Trigonometry", subTopics: ["Trigonometric Ratios", "Identities", "Allied Angles", "Compound Angles", "Multiple & Sub-multiple Angles", "Sum to Product & Product to Sum", "Trigonometric Equations", "General Solutions"] },
                { name: "Trigonometric Functions", subTopics: ["Domain, Range & Graphs", "Periodicity", "Sign of Ratios", "Max & Min Values", "Solutions of Triangles (Sine/Cosine Rules)", "Heights & Distances"] },
                { name: "ITF", subTopics: ["Principal Values", "Domain & Range of ITF", "Properties of Inverse Functions", "Interconversion", "Sum & Difference Formulas", "Simplification of Expressions"] }
            ]
        },
        {
            unit: "Vector",
            chapters: [
                { name: "Vector Algebra", subTopics: ["Types of Vectors", "Addition & Subtraction", "Section Formula", "Dot Product (Scalar)", "Cross Product (Vector)", "Scalar Triple Product (STP)", "Vector Triple Product (VTP)", "Geometrical Applications"] },
                { name: "3D Geometry", subTopics: ["Direction Cosines & Ratios", "Equation of Line in Space", "Angle between Lines", "Shortest Distance", "Equation of Plane", "Line & Plane Intersection", "Angle between Planes", "Coplanarity"] }
            ]
        }
    ]
};
