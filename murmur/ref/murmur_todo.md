Murmur Todo
- With the Eleven labs TTS Work. There's a specific workflow I would like us to try and hit that involves me doing as little as possible in the pipeline. 
    1. I give the program a csv file similar to the one I wrote for the balck door. This file is used to make the actual node connections and all that. 
    2. I got to the TTS button.
    3. I pick a narrator for the story. 
    4. I pick the model type that I want
    5. I pick the stability and similarity
    6. Then I hit the button to generate audio lines for this story. 
    
    Note how I'm not uploading a csv file of the lines that I want. Murmur is handling this. It looks at all the lines for the story that need audio for them. It has timestamps for both the last time the text was changed and the last time the audio was added. If the text lines are newer then the audio lines, we know the audio needs to be updated. Murmur creates the csv file that matches whatever format ElevenLabs needs to generate the audio (I don't do that). It sends that csv to Elevenlabs, gets back a zip file. It can open up that file (ideally) and automatically add thos files to the right nodes. So again, from a user perspective, they aren't dealing with the csvs or hooking files up, the program is.