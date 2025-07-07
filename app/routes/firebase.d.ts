declare module "../../Backend/firebase" {
  import { Auth } from "firebase/auth";
  import { Database } from "firebase/database";

  export const auth: Auth;
  export const db: Database;
}
