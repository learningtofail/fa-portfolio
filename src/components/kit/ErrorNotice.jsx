/**
 * Announces a problem or a parse warning. Renders nothing for an empty message.
 * @param {{ message: string }} props
 */
export default function ErrorNotice({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="notice notice--error">
      {message}
    </p>
  );
}
