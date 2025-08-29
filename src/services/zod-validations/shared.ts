import z from 'zod';

export const dateValidation = z.preprocess(
  (val) => {
    const date = new Date(String(val));
    return isNaN(date.getTime()) ? undefined : date;
  },
  z.date({ message: 'Tarih geçersiz.' }),
);
