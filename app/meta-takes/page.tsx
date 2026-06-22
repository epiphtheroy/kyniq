import { redirect } from "next/navigation";

// Interim: the interpretation (meta-take) layer is being rebuilt from bold takes.
// Its current content has folded into the trope layer, so visitors go to /tropes for
// now. This temporary redirect is reverted when the bold-take meta-takes land.
export default function MetaTakesIndex() {
  redirect("/tropes");
}
