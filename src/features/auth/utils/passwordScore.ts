// Diem manh mat khau 0-4 (dang ky): dai >= 8, co chu hoa, co so,
// co ky tu dac biet. Doi nguyen van tu SignUpScreen.
export function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
