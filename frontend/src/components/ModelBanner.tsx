import type { ModelInfo } from "../types";

/** Explains to the operator what is actually producing the numbers. */
export function ModelBanner({ model }: { model: ModelInfo }) {
  if (model.mode === "inference") {
    return (
      <div className="banner banner-ok">
        <strong>Trained model active.</strong>{" "}
        {model.classes.length} classes on <code>{model.device}</code>, weights from{" "}
        <code>{model.weights_path.split(/[\\/]/).slice(-2).join("/")}</code>.
      </div>
    );
  }

  const reason = model.torch_available
    ? "No checkpoint was found."
    : "PyTorch isn't installed.";

  return (
    <div className="banner banner-warn">
      <strong>Demo mode.</strong> {reason} Predictions below are deterministic placeholders
      derived from the image file, not real detections.{" "}
      {model.torch_available
        ? "Generate a synthetic dataset and train to switch to real inference."
        : "Install torch, then train a checkpoint."}
    </div>
  );
}
