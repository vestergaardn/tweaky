-- Add widget customization columns to projects table
ALTER TABLE projects
  ADD COLUMN widget_launch_type text NOT NULL DEFAULT 'button',
  ADD COLUMN widget_button_color text NOT NULL DEFAULT '#18181b',
  ADD COLUMN widget_button_text text NOT NULL DEFAULT '✦ Tweak this',
  ADD COLUMN widget_icon_only boolean NOT NULL DEFAULT false,
  ADD COLUMN widget_logo_url text,
  ADD COLUMN widget_welcome_message text,
  ADD CONSTRAINT widget_launch_type_check CHECK (widget_launch_type IN ('button', 'text-link')),
  ADD CONSTRAINT widget_welcome_message_length CHECK (char_length(widget_welcome_message) <= 150);
