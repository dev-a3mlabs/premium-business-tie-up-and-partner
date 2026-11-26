import { tartanClient } from '../../integrations/tartan/tartan.client.js';
import { ApiError, type ErrorDetail } from '../../utils/ApiError.js';
import type { OrganizationRegistrationInput } from '../organization/v1/organization.schema.js';

type GstinResult = { response?: { companyData?: { lgnm?: string; tradeNam?: string; sts?: string } } };
type PanResult = { response?: { isValid?: boolean } };
type UdyamResult = { response?: { udyamRegistrationNumber?: string; isCancelled?: boolean } };

const FIELD = 'org.registration';

const NAME_ABBREVIATIONS: Record<string, string> = {
  PVT: 'PRIVATE',
  LTD: 'LIMITED',
  CO: 'COMPANY',
  CORP: 'CORPORATION',
};

// "Acme Pvt. Ltd." and "ACME PRIVATE LIMITED" compare equal; spacing and punctuation are ignored.
const normalizeName = (name: string) =>
  name
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .split(/[^A-Z0-9]+/)
    .map((word) => NAME_ABBREVIATIONS[word] ?? word)
    .join('');

// Indian financial years run April to March, e.g. "2026-27".
const currentFinancialYear = (date = new Date()) => {
  const start = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};

const verifyGstin = (gstin: string) =>
  tartanClient.verify<GstinResult>({
    category: 'employer-profiling',
    type: 'gst-advanced',
    data: { gstin, financialYear: currentFinancialYear() },
  });

const verifyPan = (panNumber: string) =>
  tartanClient.verify<PanResult>({
    category: 'individual-pii-data',
    type: 'pan-detail-v2',
    data: { panNumber },
  });

const verifyUdyam = (udyamNumber: string) =>
  tartanClient.verify<UdyamResult>({
    category: 'employer-profiling',
    type: 'udyam-registration-details-with-certificate-v2',
    data: { udyamNumber },
  });

export const verificationService = {
  // Checks every registration number at once and reports all failures together as field errors.
  verifyRegistration: async (companyName: string, { gstin, pan, udyamNumber }: OrganizationRegistrationInput['registration']) => {
    const [gstResult, panResult, udyamResult] = await Promise.all([
      verifyGstin(gstin),
      verifyPan(pan),
      udyamNumber ? verifyUdyam(udyamNumber) : null,
    ]);

    const details: ErrorDetail[] = [];
    const company = gstResult?.response?.companyData;
    const registeredNames = [company?.lgnm, company?.tradeNam].filter((name): name is string => !!name);

    if (!company) {
      details.push({ field: `${FIELD}.gstin`, message: 'GSTIN could not be verified' });
    } else if (company.sts?.toUpperCase() !== 'ACTIVE') {
      details.push({ field: `${FIELD}.gstin`, message: 'GSTIN is not active' });
    } else if (!registeredNames.some((name) => normalizeName(name) === normalizeName(companyName))) {
      details.push({ field: 'org.name', message: 'Company name must match the name registered for this GSTIN' });
    }

    if (panResult?.response?.isValid !== true) {
      details.push({ field: `${FIELD}.pan`, message: 'PAN could not be verified' });
    }

    if (udyamNumber) {
      if (!udyamResult?.response?.udyamRegistrationNumber) {
        details.push({ field: `${FIELD}.udyamNumber`, message: 'Udyam number could not be verified' });
      } else if (udyamResult.response.isCancelled === true) {
        details.push({ field: `${FIELD}.udyamNumber`, message: 'Udyam registration is cancelled' });
      }
    }

    if (details.length > 0) throw ApiError.validation(details);

    const verifiedAt = new Date();
    return {
      legalName: company?.lgnm ?? null,
      gstinVerifiedAt: verifiedAt,
      panVerifiedAt: verifiedAt,
      udyamVerifiedAt: udyamNumber ? verifiedAt : null,
    };
  },
};
