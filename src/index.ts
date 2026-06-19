import "dotenv/config.js";
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();

async function main(){
    const response = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 1024,
        messages:[
            {role: "user", content:"In one sentence what make a debate interesting?"}
        ]
    })

    for (const block of response.content){
        if(block.type ==="text"){
            console.log(block.text);
        }
    }
}

main()