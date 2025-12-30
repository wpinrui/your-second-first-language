use std::process::Command;
use std::path::PathBuf;
use std::fs;

#[tauri::command]
fn send_message(message: String, language: String) -> Result<String, String> {
    // Get the data directory (relative to executable for now, or use app data dir)
    let data_dir = get_data_dir()?;
    let lang_dir = data_dir.join(&language);

    // Check if language is bootstrapped
    if !lang_dir.exists() {
        return Err(format!(
            "Language '{}' not set up. Run bootstrap-language.sh first.",
            language
        ));
    }

    // Run claude CLI in the language directory
    let output = Command::new("claude")
        .arg("-p")
        .arg(&message)
        .current_dir(&lang_dir)
        .output()
        .map_err(|e| format!("Failed to run claude: {}", e))?;

    if output.status.success() {
        let response = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(response.trim().to_string())
    } else {
        let error = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Claude error: {}", error))
    }
}

#[tauri::command]
fn get_vocabulary(language: String) -> Result<String, String> {
    let data_dir = get_data_dir()?;
    let vocab_file = data_dir.join(&language).join("vocabulary.json");

    fs::read_to_string(&vocab_file)
        .map_err(|e| format!("Failed to read vocabulary: {}", e))
}

#[tauri::command]
fn get_grammar(language: String) -> Result<String, String> {
    let data_dir = get_data_dir()?;
    let grammar_file = data_dir.join(&language).join("grammar.json");

    fs::read_to_string(&grammar_file)
        .map_err(|e| format!("Failed to read grammar: {}", e))
}

#[tauri::command]
fn list_languages() -> Result<Vec<String>, String> {
    let data_dir = get_data_dir()?;

    if !data_dir.exists() {
        return Ok(vec![]);
    }

    let mut languages = Vec::new();
    let entries = fs::read_dir(&data_dir)
        .map_err(|e| format!("Failed to read data directory: {}", e))?;

    for entry in entries.flatten() {
        if entry.path().is_dir() {
            if let Some(name) = entry.file_name().to_str() {
                // Skip the scripts directory
                if name != "scripts" {
                    languages.push(name.to_string());
                }
            }
        }
    }

    Ok(languages)
}

fn get_data_dir() -> Result<PathBuf, String> {
    // For now, use ./data relative to current working directory
    // In production, we'd use app_data_dir from tauri
    Ok(PathBuf::from("./data"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            send_message,
            get_vocabulary,
            get_grammar,
            list_languages
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
