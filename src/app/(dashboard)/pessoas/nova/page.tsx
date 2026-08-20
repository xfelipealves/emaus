import { PersonForm } from "./person-form";

export default function NewPersonPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div>
        <p className="text-sm font-medium text-[#26766d]">Pessoas</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Cadastrar Pessoa</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Comece com o essencial. Você poderá acompanhar o histórico no perfil.</p>
      </div>
      <div className="mt-8">
        <PersonForm />
      </div>
    </div>
  );
}
