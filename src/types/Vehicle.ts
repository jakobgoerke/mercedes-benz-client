import { z } from 'zod';

export const VehicleSchema = z
  .object({
    fin: z.string().optional(),
    vin: z.string(),
    licensePlate: z.string().optional(),
    salesRelatedInformation: z
      .object({
        baumuster: z.object({ baumusterDescription: z.string().optional() }).partial().optional(),
        line: z.object({ lineDescription: z.string().optional() }).partial().optional(),
        model: z
          .object({
            modelDescription: z.string().optional(),
            modelYear: z.string().optional(),
          })
          .partial()
          .optional(),
      })
      .partial()
      .optional(),
  })
  .transform((v) => ({
    vin: v.vin,
    fin: v.fin ?? v.vin,
    // The API sends an empty string when no plate is registered in the app.
    licensePlate: v.licensePlate?.trim() || undefined,
    // `model.modelDescription` is often absent; the baumuster description
    // (e.g. "EQA 250+") is what the Mercedes app itself shows.
    model: v.salesRelatedInformation?.model?.modelDescription || v.salesRelatedInformation?.baumuster?.baumusterDescription,
    modelYear: v.salesRelatedInformation?.model?.modelYear,
  }));

export type Vehicle = z.infer<typeof VehicleSchema>;
