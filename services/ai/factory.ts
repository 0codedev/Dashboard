
import { UserIntent, IPersona } from './types';
import { CoachPersona } from './personas/Coach';
import { TutorPersona } from './personas/Tutor';
import { TherapistPersona } from './personas/Therapist';
import { GeneralistPersona } from './personas/Generalist';

export const getPersona = (intent: UserIntent): IPersona => {
  switch (intent) {
    case 'ANALYSIS':
    case 'PLANNING': // Coach handles planning too for now
      return new CoachPersona();
    case 'CONCEPT':
      return new TutorPersona();
    case 'EMOTIONAL':
      return new TherapistPersona();
    case 'GENERAL':
    default:
      return new GeneralistPersona();
  }
};
