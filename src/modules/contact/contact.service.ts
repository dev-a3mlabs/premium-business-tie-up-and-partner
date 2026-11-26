import { contactRepository } from './contact.repository.js';
import type { ContactInput } from './v1/contact.schema.js';

export const contactService = {
  submit: async (input: ContactInput) => {
    await contactRepository.create(input);
  },
};
