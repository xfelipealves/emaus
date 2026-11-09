"use server";

import { runAction } from "@/server/action";
import { selfCheckin, selfRegisterVisitor } from "@/server/events";
import { rateLimit } from "@/server/rate-limit";
import { ActionError } from "@/server/session";

export async function selfCheckinAction(token: string, phone: string) {
  return runAction(async () => {
    if (!(await rateLimit("checkin"))) throw new ActionError("Muitas tentativas. Aguarde um minuto.");
    return selfCheckin(token, phone);
  });
}

export async function selfVisitorAction(token: string, fullName: string, phone: string) {
  return runAction(async () => {
    if (!(await rateLimit("visitor", 5))) throw new ActionError("Muitas tentativas. Aguarde um minuto.");
    if (fullName.trim().length < 3) throw new ActionError("Informe seu nome completo.");
    const p = await selfRegisterVisitor(token, fullName, phone);
    return { name: p.fullName.split(" ")[0] };
  });
}
