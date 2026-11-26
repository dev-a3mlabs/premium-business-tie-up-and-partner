import type { Request, Response } from 'express';
import { sendSuccess } from '../../../utils/response.js';
import { contactService } from '../contact.service.js';

export const submitContact = async (req: Request, res: Response) => {
  await contactService.submit(req.body);
  sendSuccess(res, { message: 'Your message was received.', statusCode: 202 });
};
