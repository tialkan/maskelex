// Karar sonundaki rol, ad ve sicil satırlarını birlikte tanır.
export function judgeSignatures(text: string): Array<{ name?: { start: number; end: number }; number?: { start: number; end: number } }> {
  const re = /^[ \t]*(?:Başkan|BAŞKAN|Üye|ÜYE)[ \t]*\r?\n[ \t]*((?:\p{Lu}[\p{L}]+(?:[ \t]+\p{Lu}[\p{L}]+){1,3})|(?:\[[^\]\r\n]+\]))[ \t]*\r?\n[ \t]*([0-9]{4,8}|\[[^\]\r\n]+\])[ \t]*(?=\r?$)/gmu;
  return [...text.matchAll(re)].map((m) => {
    const nameStart = m.index! + m[0].indexOf(m[1]!);
    const numberStart = m.index! + m[0].lastIndexOf(m[2]!);
    return {
      ...(!m[1]!.startsWith('[') ? { name: { start: nameStart, end: nameStart + m[1]!.length } } : {}),
      ...(!m[2]!.startsWith('[') ? { number: { start: numberStart, end: numberStart + m[2]!.length } } : {}),
    };
  });
}
