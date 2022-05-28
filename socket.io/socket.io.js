// running in a none node.js/socket.io backend. Just a simple WebServer
// In this case we provide a Socket.io mock object without any functionality
//
function io(){
    return {
        emit:function(){

        },
        on:function(event, callback){
            // fake the successfull connection in the serverless enviroment
            //
            if(event==="connect"){
                setTimeout(callback,1);
            }
        }
    };
}